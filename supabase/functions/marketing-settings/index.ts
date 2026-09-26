import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { checkFacebookScopes } from '../_shared/meta-token-policy.ts'
import { KNOWLEDGE_BASE_MAX_CHARS } from '../_shared/ai-config.ts'

/** 「接続状態」画面用のエンドポイント。
 *
 * meta_credentials / marketing_settings はどちらも RLS 有効・ポリシーゼロ
 * （service_role 専用）なので、他の広報画面と同じく Edge Function 経由にする。
 * 生トークン（vault_secret_name が指す実体）はここでは一切読まない。
 */

type CredentialRow = {
  id: 'instagram_login' | 'facebook_page'
  platform: 'instagram' | 'facebook'
  account_ref: string
  token_type: string
  expires_at: string | null
  data_access_expires_at: string | null
  scopes: string[] | null
  last_refreshed_at: string | null
  last_checked_at: string | null
  last_error: string | null
  status: 'active' | 'needs_reauth' | 'expired'
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

    const access = await requireAdmin(req, admin, corsHeaders)
    if (!access.ok) return access.response

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action ?? '')

    switch (action) {
      case 'get': {
        const [{ data: settings }, { data: credRows }] = await Promise.all([
          admin.from('marketing_settings').select('*').eq('id', 'global').maybeSingle(),
          admin.from('meta_credentials').select(
            'id, platform, account_ref, token_type, expires_at, data_access_expires_at, scopes, last_refreshed_at, last_checked_at, last_error, status',
          )
            // facebook_ads_system_user は広告読み取り専用の内部クレデンシャルで、
            // Page トークンとはスコープの前提が異なる（pages_messaging 等を持たない）。
            // 同じ画面に混ぜると「Facebook」カードが2枚並び、かつ的外れな
            // missingExtendedScopes 警告が出るため、この画面には出さない。
            .in('id', ['instagram_login', 'facebook_page']),
        ])

        const credentials = ((credRows ?? []) as CredentialRow[]).map((c) => ({
          ...c,
          // FB のみ意味がある。IG は Standard Access で足りる設計のため常に空。
          missingExtendedScopes: c.platform === 'facebook' ? checkFacebookScopes(c.scopes).missingExtended : [],
        }))

        return json({
          settings: settings ?? {
            social_autopost_enabled: true,
            auto_reply_enabled: false,
            auto_reply_dry_run: true,
            ai_reply_enabled: false,
            ai_reply_dry_run: true,
            knowledge_store_id: null,
          },
          credentials,
          knowledge: await loadKnowledgeSummary(
            admin,
            (settings?.knowledge_store_id as string | null | undefined) ?? (await findOwnStoreId(admin, access.userId)),
          ),
        })
      }

      case 'update_settings': {
        const patch: Record<string, boolean | string> = {}
        for (
          const key of [
            'social_autopost_enabled',
            'auto_reply_enabled',
            'auto_reply_dry_run',
            'ai_reply_enabled',
            'ai_reply_dry_run',
          ] as const
        ) {
          if (typeof body?.[key] === 'boolean') patch[key] = body[key]
        }
        if (Object.keys(patch).length === 0) return json({ error: 'no valid fields' }, 400)

        // AI 応答をオンにするとき、参照する学習データの店舗が未設定なら
        // 操作した管理者自身の店舗（LINE の自動応答で使っているもの）に結び付ける。
        // cron にはログインユーザーが居ないため、ここで確定させておく必要がある。
        if (patch.ai_reply_enabled === true) {
          const { data: current } = await admin
            .from('marketing_settings')
            .select('knowledge_store_id')
            .eq('id', 'global')
            .maybeSingle()
          if (!current?.knowledge_store_id) {
            const storeId = await findOwnStoreId(admin, access.userId)
            if (!storeId) return json({ error: 'AI学習データを持つ店舗が見つかりません' }, 400)
            patch.knowledge_store_id = storeId
          }
        }

        const { error } = await admin
          .from('marketing_settings')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', 'global')
        if (error) throw error
        return json({ ok: true })
      }

      case 'refresh_now': {
        // meta-token-refresh 本体を叩く。ロジックを二重に持たないため
        // （marketing-posts の publish_next と同じ考え方）。
        const cronSecret = Deno.env.get('SOCIAL_CRON_SECRET')
        if (!cronSecret) return json({ error: 'SOCIAL_CRON_SECRET is not configured' }, 500)

        const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/meta-token-refresh`, {
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

      default:
        return json({ error: `unknown action: ${action}` }, 400)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[marketing-settings]', message)
    return json({ error: message }, 500)
  }
})

async function findOwnStoreId(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.from('stores').select('id').eq('owner_id', userId).maybeSingle()
  return (data?.id as string | undefined) ?? null
}

/**
 * 自動応答画面に出す「AI が参照する学習データ」の要約。本文そのものは返さない
 * （文字数と資料名だけで十分で、編集は LINE の自動応答画面で行う）。
 */
async function loadKnowledgeSummary(admin: SupabaseClient, storeId: string | null) {
  if (!storeId) return null
  const [{ data: store }, { data: docs }, { data: ai }] = await Promise.all([
    admin.from('stores').select('name').eq('id', storeId).maybeSingle(),
    admin
      .from('knowledge_base')
      .select('id, file_name, is_active, extracted_text, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: true }),
    admin.from('ai_settings').select('tone, persona_prompt').eq('store_id', storeId).maybeSingle(),
  ])
  const docViews = (docs ?? []).map((d) => ({
    id: d.id as string,
    fileName: d.file_name as string,
    isActive: d.is_active as boolean,
    chars: ((d.extracted_text as string | null) ?? '').length,
  }))
  return {
    storeId,
    storeName: (store?.name as string | null | undefined) ?? null,
    tone: ai?.tone === 'friendly' ? 'friendly' : 'polite',
    hasPersona: !!(ai?.persona_prompt as string | null | undefined)?.trim(),
    docs: docViews,
    activeChars: docViews.filter((d) => d.isActive).reduce((sum, d) => sum + d.chars, 0),
    maxChars: KNOWLEDGE_BASE_MAX_CHARS,
  }
}
