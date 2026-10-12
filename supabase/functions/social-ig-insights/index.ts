import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { getToken } from '../_shared/meta-tokens.ts'
import {
  classifyGraphError,
  describeGraphError,
  type GraphError,
  type GraphInsightsResponse,
  jstDate,
  pickInsightValue,
} from '../_shared/ig-insights.ts'

/**
 * Instagram のフォロワー数と、投稿ごとのいいね・コメント・保存・リーチを読み、
 * その日のスナップショットとして保存する（読み取りだけ。Instagram には何も書かない）。
 *
 * - フォロワー数・いいね・コメントは、投稿に使っているトークンの権限で取れる見込み。
 * - 保存・リーチは instagram_business_manage_insights が要る。取れなければ値は null のまま、
 *   理由（code とメッセージ）を insights_error に残す。権限不足と対象外は classify で見分ける。
 * - URL にトークンが入るので、URL・トークンはログにもエラーにも出さない。
 *
 * social-dm-poll と同じ二重受付（pg_cron の x-cron-secret と、管理画面からの JWT）。
 */

const IG_BASE = 'https://graph.instagram.com/v21.0'
const MAX_MEDIA_PAGES = 10
const INSIGHTS_BATCH = 5

type GraphMedia = {
  id: string
  media_product_type?: string
  media_type?: string
  permalink?: string
  timestamp?: string
  like_count?: number
  comments_count?: number
}

type MediaPage = { data?: GraphMedia[]; paging?: { next?: string }; error?: GraphError }
type ProfileResponse = { followers_count?: number; follows_count?: number; media_count?: number; error?: GraphError }

/** GET して JSON を返す。通信の失敗は error として返し、URL は含めない。 */
async function graphGet<T extends { error?: GraphError }>(url: string): Promise<T> {
  try {
    const res = await fetch(url)
    return (await res.json()) as T
  } catch (e) {
    return { error: { message: `fetch failed: ${e instanceof Error ? e.name : 'unknown'}` } } as T
  }
}

/** 投稿1件の reach と saved。まとめて失敗したら1つずつ試し、どちらが取れないかを分ける。 */
async function fetchMediaInsights(
  mediaId: string,
  token: string,
): Promise<{ reach: number | null; saved: number | null; error: string | null }> {
  const t = encodeURIComponent(token)
  const both = await graphGet<GraphInsightsResponse>(`${IG_BASE}/${mediaId}/insights?metric=reach,saved&access_token=${t}`)
  if (!both.error) {
    return { reach: pickInsightValue(both, 'reach'), saved: pickInsightValue(both, 'saved'), error: null }
  }
  const errors: string[] = []
  const one = async (metric: 'reach' | 'saved') => {
    const r = await graphGet<GraphInsightsResponse>(`${IG_BASE}/${mediaId}/insights?metric=${metric}&access_token=${t}`)
    if (r.error) {
      errors.push(`${metric} [${classifyGraphError(r.error)}] ${describeGraphError(r.error)}`)
      return null
    }
    return pickInsightValue(r, metric)
  }
  const reach = await one('reach')
  const saved = await one('saved')
  return { reach, saved, error: errors.length > 0 ? errors.join(' | ') : null }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const cronSecret = Deno.env.get('SOCIAL_CRON_SECRET')
    const providedSecret = req.headers.get('x-cron-secret')
    const isCron = !!cronSecret && providedSecret === cronSecret
    if (!isCron) {
      const access = await requireAdmin(req, admin, corsHeaders)
      if (!access.ok) return access.response
    }

    const igLookup = await getToken(admin, 'instagram_login')
    const { data: igCred } = await admin
      .from('meta_credentials')
      .select('account_ref')
      .eq('id', 'instagram_login')
      .maybeSingle()
    if (!igLookup || !igCred?.account_ref) {
      return json({ ok: true, skipped: true, reason: 'instagram token is not configured' })
    }
    const token = igLookup.token
    const ref = igCred.account_ref as string
    const t = encodeURIComponent(token)
    const snapshotDate = jstDate(new Date())

    // アカウント: フォロワー数など（投稿に使うトークンの権限で取れる見込みの項目）
    const profile = await graphGet<ProfileResponse>(
      `${IG_BASE}/${ref}?fields=followers_count,follows_count,media_count&access_token=${t}`,
    )
    // アカウント: 前日のリーチ。フォロワー数の下限などで取れないことがあるので分けて記録する
    const acctInsights = await graphGet<GraphInsightsResponse>(
      `${IG_BASE}/${ref}/insights?metric=reach&period=day&metric_type=total_value&access_token=${t}`,
    )
    const accountRow = {
      snapshot_date: snapshotDate,
      followers_count: profile.error ? null : (profile.followers_count ?? null),
      follows_count: profile.error ? null : (profile.follows_count ?? null),
      media_count: profile.error ? null : (profile.media_count ?? null),
      reach_last_day: acctInsights.error ? null : pickInsightValue(acctInsights, 'reach'),
      profile_error: profile.error ? `[${classifyGraphError(profile.error)}] ${describeGraphError(profile.error)}` : null,
      insights_error: acctInsights.error
        ? `[${classifyGraphError(acctInsights.error)}] ${describeGraphError(acctInsights.error)}`
        : null,
      fetched_at: new Date().toISOString(),
    }
    const { error: accountWriteError } = await admin
      .from('social_ig_account_daily')
      .upsert(accountRow, { onConflict: 'snapshot_date' })
    if (accountWriteError) throw new Error(`social_ig_account_daily: ${accountWriteError.message}`)

    // 投稿: ページ送りで取り切る（上限 MAX_MEDIA_PAGES ページ）
    const media: GraphMedia[] = []
    let mediaError: string | null = null
    let next: string | null =
      `${IG_BASE}/${ref}/media?fields=id,media_product_type,media_type,permalink,timestamp,like_count,comments_count&limit=50&access_token=${t}`
    for (let page = 0; page < MAX_MEDIA_PAGES && next; page++) {
      const res: MediaPage = await graphGet<MediaPage>(next)
      if (res.error) {
        mediaError = `[${classifyGraphError(res.error)}] ${describeGraphError(res.error)}`
        break
      }
      media.push(...(res.data ?? []))
      next = res.paging?.next ?? null
    }

    // 投稿ごとの保存・リーチ（少しずつ並列に）
    const rows: Array<Record<string, unknown>> = []
    for (let i = 0; i < media.length; i += INSIGHTS_BATCH) {
      const batch = media.slice(i, i + INSIGHTS_BATCH)
      const insights = await Promise.all(batch.map((m) => fetchMediaInsights(m.id, token)))
      batch.forEach((m, j) => {
        rows.push({
          media_id: m.id,
          snapshot_date: snapshotDate,
          media_product_type: m.media_product_type ?? null,
          media_type: m.media_type ?? null,
          permalink: m.permalink ?? null,
          posted_at: m.timestamp ?? null,
          like_count: m.like_count ?? null,
          comments_count: m.comments_count ?? null,
          reach: insights[j].reach,
          saved: insights[j].saved,
          insights_error: insights[j].error,
          fetched_at: new Date().toISOString(),
        })
      })
    }
    if (rows.length > 0) {
      const { error: mediaWriteError } = await admin
        .from('social_ig_media_daily')
        .upsert(rows, { onConflict: 'media_id,snapshot_date' })
      if (mediaWriteError) throw new Error(`social_ig_media_daily: ${mediaWriteError.message}`)
    }

    // 取れた・取れなかったの要約（理由ごとの件数）。値そのものは DB を見る。
    const reasons: Record<string, number> = {}
    for (const r of rows) {
      const e = r.insights_error as string | null
      if (e) reasons[e] = (reasons[e] ?? 0) + 1
    }
    return json({
      ok: true,
      snapshot_date: snapshotDate,
      account: {
        followers_count: accountRow.followers_count,
        reach_last_day: accountRow.reach_last_day,
        profile_error: accountRow.profile_error,
        insights_error: accountRow.insights_error,
      },
      media: {
        count: rows.length,
        with_like_count: rows.filter((r) => r.like_count != null).length,
        with_reach: rows.filter((r) => r.reach != null).length,
        with_saved: rows.filter((r) => r.saved != null).length,
        list_error: mediaError,
        insights_errors: reasons,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[social-ig-insights]', message)
    return json({ error: message }, 500)
  }
})
