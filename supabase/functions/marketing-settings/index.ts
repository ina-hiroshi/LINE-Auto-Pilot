import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { checkFacebookScopes } from '../_shared/meta-token-policy.ts'

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
          ),
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
          },
          credentials,
        })
      }

      case 'update_settings': {
        const patch: Record<string, boolean> = {}
        for (const key of ['social_autopost_enabled', 'auto_reply_enabled', 'auto_reply_dry_run'] as const) {
          if (typeof body?.[key] === 'boolean') patch[key] = body[key]
        }
        if (Object.keys(patch).length === 0) return json({ error: 'no valid fields' }, 400)

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
