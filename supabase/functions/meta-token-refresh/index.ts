import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { sendAdminAlert } from '../_shared/admin-alert.ts'
import { getToken, setToken } from '../_shared/meta-tokens.ts'
import { checkFacebookScopes, isNearingExpiry, shouldRefreshInstagram } from '../_shared/meta-token-policy.ts'

const IG_BASE = 'https://graph.instagram.com/v21.0'
const FB_BASE = 'https://graph.facebook.com/v21.0'

type CredentialRow = {
  id: 'instagram_login' | 'facebook_page'
  platform: 'instagram' | 'facebook'
  account_ref: string
  vault_secret_name: string
  token_type: string
  expires_at: string | null
  data_access_expires_at: string | null
  scopes: string[] | null
  last_refreshed_at: string | null
  last_checked_at: string | null
  last_error: string | null
  status: 'active' | 'needs_reauth' | 'expired'
}

/**
 * meta_credentials に行がまだ無ければ、現行の Supabase Secrets の値を
 * Vault へコピーして種を作る。カットオーバーの Step1-2 に相当する。
 * 値は Deno.env.get() でこの関数の中だけを通り、呼び出し元やログには出さない。
 */
async function ensureBootstrapped(admin: SupabaseClient) {
  const targets: Array<{
    id: CredentialRow['id']
    platform: CredentialRow['platform']
    envToken: string
    envAccountRef: string
    vaultSecretName: string
    tokenType: string
    // 実際の発行日時。secrets の updated_at から把握済みの既知の値
    // （トークン本体ではないため会話ログに出しても問題ない）。
    issuedAt: string
  }> = [
    {
      id: 'instagram_login',
      platform: 'instagram',
      envToken: 'INSTAGRAM_ACCESS_TOKEN',
      envAccountRef: 'INSTAGRAM_USER_ID',
      vaultSecretName: 'meta_instagram_login_token',
      tokenType: 'ig_login',
      issuedAt: '2026-09-03T12:05:51.121Z',
    },
    {
      id: 'facebook_page',
      platform: 'facebook',
      envToken: 'FACEBOOK_ACCESS_TOKEN',
      envAccountRef: 'FACEBOOK_PAGE_ID',
      vaultSecretName: 'meta_facebook_page_token',
      tokenType: 'fb_page',
      issuedAt: '2026-09-04T12:36:56.322Z',
    },
  ]

  for (const t of targets) {
    const { data: existing } = await admin
      .from('meta_credentials')
      .select('id')
      .eq('id', t.id)
      .maybeSingle()
    if (existing) continue

    const rawToken = Deno.env.get(t.envToken)
    const accountRef = Deno.env.get(t.envAccountRef)
    if (!rawToken || !accountRef) {
      // 種になる値が無ければ、行も作らない。次回起動時に再試行される。
      continue
    }

    await setToken(admin, t.vaultSecretName, rawToken, `${t.id} access token (migrated from Supabase Secrets)`)
    await admin.from('meta_credentials').insert({
      id: t.id,
      platform: t.platform,
      account_ref: accountRef,
      vault_secret_name: t.vaultSecretName,
      token_type: t.tokenType,
      last_refreshed_at: t.issuedAt,
      status: 'active',
    })
  }
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

    // pg_cron（日次 03:00 JST）と、設定画面からの手動実行の両方を受け付ける。
    // cron は JWT を持たないため、社内共有シークレットで先に判定する。
    // config.toml で verify_jwt=false にしてあるのはこの二重受付のため
    // （true にすると cron 呼び出しがゲートウェイで 401 になる）。
    const cronSecret = Deno.env.get('SOCIAL_CRON_SECRET')
    const providedSecret = req.headers.get('x-cron-secret')
    const isCron = !!cronSecret && providedSecret === cronSecret
    if (!isCron) {
      const access = await requireAdmin(req, admin, corsHeaders)
      if (!access.ok) return access.response
    }

    await ensureBootstrapped(admin)

    const now = new Date()
    const alertLines: string[] = []

    const { data: rows } = await admin.from('meta_credentials').select('*')
    const creds = (rows ?? []) as CredentialRow[]
    const ig = creds.find((c) => c.id === 'instagram_login') ?? null
    const fb = creds.find((c) => c.id === 'facebook_page') ?? null

    const result: Record<string, unknown> = {}

    // --- Instagram ---
    if (ig) {
      const lookup = await getToken(admin, 'instagram_login')
      if (!lookup) {
        result.instagram = { error: 'no token available' }
      } else {
        // debug_token が IG では使えない（IGApiException code 10）ため、
        // 疎通確認は /me を軽く叩くだけにする。失効・失効間近は refresh の
        // 成否そのもので判定する（IG は自分で時計を持つしかない）。
        const patch: Partial<CredentialRow> & { updated_at: string } = {
          last_checked_at: now.toISOString(),
          updated_at: now.toISOString(),
        }

        if (shouldRefreshInstagram(ig.last_refreshed_at, now)) {
          const res = await fetch(
            `${IG_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(lookup.token)}`,
          )
          const body = await res.json()
          if (body.access_token && body.expires_in) {
            await setToken(admin, ig.vault_secret_name, body.access_token, 'instagram_login access token')
            patch.last_refreshed_at = now.toISOString()
            patch.expires_at = new Date(now.getTime() + body.expires_in * 1000).toISOString()
            patch.last_error = null
            patch.status = 'active'
            result.instagram = { refreshed: true, expiresAt: patch.expires_at, tokenSource: lookup.source }
          } else {
            const message = JSON.stringify(body.error ?? body)
            patch.last_error = message
            // OAuthException = トークン自体が無効。日数マージンを待たず即座に知らせる。
            if (body.error?.type === 'OAuthException' || body.error?.code === 190) {
              patch.status = 'needs_reauth'
              alertLines.push(`・Instagram: トークンが無効になっています（${message}）`)
            } else {
              // 一過性の失敗でも、次に成功するまで誰も知らないままだと
              // 「20日マージンで週1回失敗しても間に合う」が成立しなくなる。
              // 失効までの日数に関わらず、失敗そのものを毎回知らせる。
              alertLines.push(`・Instagram: トークンの更新に失敗しました（${message}）。次回の cron で再試行します`)
            }
            result.instagram = { refreshed: false, error: message, tokenSource: lookup.source }
          }
        } else {
          result.instagram = { refreshed: false, reason: 'not due yet (min 24h between refreshes)', tokenSource: lookup.source }
        }

        const effectiveExpiresAt = (patch.expires_at as string | undefined) ?? ig.expires_at
        if (patch.status !== 'needs_reauth' && isNearingExpiry(effectiveExpiresAt ?? null, now)) {
          patch.status = 'needs_reauth'
          alertLines.push(`・Instagram: トークンの失効が近づいています（${effectiveExpiresAt}）`)
        } else if (patch.status !== 'needs_reauth') {
          patch.status = 'active'
        }

        await admin.from('meta_credentials').update(patch).eq('id', 'instagram_login')
      }
    }

    // --- Facebook ---
    if (fb) {
      // FBはIGと違い自動更新できない（都度ユーザーの再認可が要る）。再認可後、
      // scripts/refresh_facebook_token.sh は今も Supabase Secrets の
      // FACEBOOK_ACCESS_TOKEN を書き換える（Vaultへ直接書く手段が
      // ローカルスクリプトには無いため）。ここで env と Vault の値を比べ、
      // ずれていれば env を正として Vault を同期する。これにより
      // 「再認可した／スクリプトを回した」だけで、次のこの関数の実行
      // （日次 cron か設定画面の手動実行）で自動的に反映される。
      const envToken = Deno.env.get('FACEBOOK_ACCESS_TOKEN')
      if (envToken) {
        const current = await getToken(admin, 'facebook_page')
        if (!current || current.token !== envToken) {
          await setToken(admin, fb.vault_secret_name, envToken, 'facebook_page access token (resynced from Supabase Secrets)')
        }
      }

      const lookup = await getToken(admin, 'facebook_page')
      if (!lookup) {
        result.facebook = { error: 'no token available' }
      } else {
        const res = await fetch(
          `${FB_BASE}/debug_token?input_token=${encodeURIComponent(lookup.token)}&access_token=${encodeURIComponent(lookup.token)}`,
        )
        const body = await res.json()
        const data = body.data

        const patch: Partial<CredentialRow> & { updated_at: string } = {
          last_checked_at: now.toISOString(),
          updated_at: now.toISOString(),
        }

        if (!data) {
          patch.last_error = JSON.stringify(body.error ?? body)
          patch.status = 'needs_reauth'
          alertLines.push(`・Facebook: トークンを検証できませんでした（${patch.last_error}）`)
        } else {
          patch.scopes = data.scopes ?? []
          patch.expires_at = data.expires_at ? new Date(data.expires_at * 1000).toISOString() : null
          patch.data_access_expires_at = data.data_access_expires_at
            ? new Date(data.data_access_expires_at * 1000).toISOString()
            : null
          patch.last_error = data.is_valid ? null : 'debug_token reports is_valid=false'

          const scopeCheck = checkFacebookScopes(patch.scopes)
          if (!data.is_valid) {
            patch.status = 'needs_reauth'
            alertLines.push('・Facebook: トークンが無効です（debug_token: is_valid=false）')
          } else if (scopeCheck.missingCritical.length > 0) {
            patch.status = 'needs_reauth'
            alertLines.push(
              `・Facebook: 既存機能に必要なスコープが失われています（${scopeCheck.missingCritical.join(', ')}）。自動投稿が壊れている可能性があります`,
            )
          } else if (isNearingExpiry(patch.data_access_expires_at ?? null, now)) {
            patch.status = 'needs_reauth'
            alertLines.push(`・Facebook: データアクセス期限が近づいています（${patch.data_access_expires_at}）`)
          } else {
            patch.status = 'active'
          }

          result.facebook = {
            isValid: data.is_valid,
            scopes: patch.scopes,
            missingExtendedScopes: scopeCheck.missingExtended,
            dataAccessExpiresAt: patch.data_access_expires_at,
          }
        }

        await admin.from('meta_credentials').update(patch).eq('id', 'facebook_page')
      }
    }

    if (alertLines.length > 0) {
      await sendAdminAlert('Meta連携トークンの確認が必要です', [
        ...alertLines,
        '',
        '管理画面の「広報 > 設定」で状態を確認してください。',
        'Facebook の再認可が必要な場合は同意ダイアログの操作のみお願いします（それ以外は自動で反映します）。',
      ])
    }

    return json({ ok: true, alerted: alertLines.length > 0, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[meta-token-refresh]', message)
    return json({ error: message }, 500)
  }
})
