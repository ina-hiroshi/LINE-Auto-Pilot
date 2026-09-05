import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { getToken } from '../_shared/meta-tokens.ts'
import {
  ABANDON_MARKER,
  MAX_ATTEMPTS,
  buildQueueView,
  type SocialPostRow,
} from './queue.ts'

const IG_BASE = 'https://graph.instagram.com/v21.0'

/** 投稿キューの管理画面用エンドポイント。
 *
 * social_posts は RLS 有効・ポリシーゼロ（service_role 専用）なので、
 * 他ページのような supabase.from(...) の直読みができない。読み書きの
 * 両方をこの関数に通し、認可経路を1本にまとめる。
 */
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const access = await requireAdmin(req, admin, corsHeaders)
    if (!access.ok) return access.response

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action ?? '')

    const loadRows = async (): Promise<SocialPostRow[]> => {
      const { data, error } = await admin
        .from('social_posts')
        .select('id, slug, platform, caption, image_urls, sort_order, status, attempts, error, permalink, platform_media_id, posted_at, claimed_at, created_at')
        .order('sort_order', { ascending: true })
        .order('platform', { ascending: true })
      if (error) throw error
      return (data ?? []) as SocialPostRow[]
    }

    switch (action) {
      case 'list': {
        return json(buildQueueView(await loadRows(), new Date()))
      }

      case 'update_caption': {
        const slug = String(body?.slug ?? '')
        const caption = String(body?.caption ?? '')
        const platform = body?.platform ? String(body.platform) : null
        if (!slug) return json({ error: 'slug is required' }, 400)
        if (!caption.trim()) return json({ error: 'caption must not be empty' }, 400)

        // 投稿済みの行は書き換えない。DB だけ変えても Meta 側の本文は変わらず、
        // 画面と実際の投稿が食い違う状態を作ってしまう。
        let q = admin.from('social_posts').update({ caption }).eq('slug', slug).neq('status', 'posted')
        if (platform) q = q.eq('platform', platform)
        const { error } = await q
        if (error) throw error
        return json({ ok: true })
      }

      case 'reorder': {
        const slug = String(body?.slug ?? '')
        const direction = String(body?.direction ?? '')
        if (!slug) return json({ error: 'slug is required' }, 400)
        if (direction !== 'up' && direction !== 'down') {
          return json({ error: 'direction must be "up" or "down"' }, 400)
        }

        const rows = await loadRows()

        // 21:00 の自動投稿が走っている最中に sort_order を動かすと、掴まれた行と
        // キューの並びが食い違う。処理中の行がある間は触らせない。
        if (rows.some((r) => r.status === 'publishing')) {
          return json({ error: '投稿処理中のため並び順を変更できません。少し待ってからお試しください' }, 409)
        }

        const view = buildQueueView(rows, new Date())
        // 投稿待ちの slug だけを対象にする。投稿済みや見送り済みを動かしても意味がない。
        // 画面側もこの条件（remaining > 0）と同じ基準で矢印を出している。
        const movable = view.slugs.filter((s) => s.remaining > 0).map((s) => s.slug)
        const idx = movable.indexOf(slug)
        if (idx < 0) return json({ error: 'slug is not in the pending queue' }, 400)
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1
        if (targetIdx < 0 || targetIdx >= movable.length) return json({ ok: true, moved: false })

        const otherSlug = movable[targetIdx]
        const sortOf = (s: string) => rows.find((r) => r.slug === s)!.sort_order
        const a = sortOf(slug)
        const b = sortOf(otherSlug)

        const r1 = await admin.from('social_posts').update({ sort_order: b }).eq('slug', slug)
        if (r1.error) throw r1.error
        const r2 = await admin.from('social_posts').update({ sort_order: a }).eq('slug', otherSlug)
        if (r2.error) throw r2.error
        return json({ ok: true, moved: true })
      }

      case 'retry': {
        const slug = String(body?.slug ?? '')
        const platform = body?.platform ? String(body.platform) : null
        if (!slug) return json({ error: 'slug is required' }, 400)

        let q = admin
          .from('social_posts')
          .update({ status: 'pending', attempts: 0, error: null, claimed_at: null })
          .eq('slug', slug)
          .eq('status', 'failed')
        if (platform) q = q.eq('platform', platform)
        const { error } = await q
        if (error) throw error
        return json({ ok: true })
      }

      case 'abandon': {
        const slug = String(body?.slug ?? '')
        const platform = body?.platform ? String(body.platform) : null
        if (!slug) return json({ error: 'slug is required' }, 400)

        // claim_next_social_post_batch() は attempts < MAX_ATTEMPTS の行しか拾わない。
        // 試行回数を上限まで押し上げることでキューから外す。これをしないと
        // 詰まった 1 slug が後続の投稿日を丸ごと押し下げ続ける。
        let q = admin
          .from('social_posts')
          .update({
            status: 'failed',
            attempts: MAX_ATTEMPTS,
            error: ABANDON_MARKER,
            claimed_at: null,
          })
          .eq('slug', slug)
          .in('status', ['pending', 'failed'])
        if (platform) q = q.eq('platform', platform)
        const { error } = await q
        if (error) throw error
        return json({ ok: true })
      }

      case 'publish_next': {
        // cron 本体と同じ経路を叩く。投稿ロジックを二重に持たないため。
        const cronSecret = Deno.env.get('SOCIAL_CRON_SECRET')
        if (!cronSecret) return json({ error: 'SOCIAL_CRON_SECRET is not configured' }, 500)

        const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/social-post-publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
          body: '{}',
        })
        const text = await res.text()
        let parsed: unknown
        try {
          parsed = JSON.parse(text)
        } catch {
          parsed = { raw: text.slice(0, 500) }
        }
        return json({ ok: res.ok, status: res.status, result: parsed })
      }

      case 'insights': {
        const lookup = await getToken(admin, 'instagram_login')
        if (!lookup) return json({ error: 'instagram token is not configured' }, 500)
        const token = lookup.token

        const rows = await loadRows()
        const targets = rows.filter(
          (r) => r.platform === 'instagram' && r.status === 'posted' && r.platform_media_id,
        )

        // impressions は v21 の CAROUSEL_ALBUM では非対応。
        // 混ぜるとリクエスト全体がエラーになるので入れない。
        const metrics = 'views,reach,likes,comments,saved,shares,total_interactions'
        const results = await Promise.all(
          targets.map(async (r) => {
            try {
              const url = `${IG_BASE}/${r.platform_media_id}/insights?metric=${metrics}&access_token=${token}`
              const res = await fetch(url)
              const body = await res.json()
              if (body.error) return { slug: r.slug, error: String(body.error.message ?? 'unknown') }
              const values: Record<string, number> = {}
              for (const entry of body.data ?? []) {
                values[entry.name] = entry.values?.[0]?.value ?? 0
              }
              return { slug: r.slug, values }
            } catch (e) {
              return { slug: r.slug, error: e instanceof Error ? e.message : String(e) }
            }
          }),
        )
        return json({ insights: results })
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[marketing-posts]', message)
    return json({ error: message }, 500)
  }
})
