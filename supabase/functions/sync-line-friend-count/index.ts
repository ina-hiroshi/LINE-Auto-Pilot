import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'

type LineAccountRow = {
  id: string
  store_id: string
  channel_access_token: string
}

type FollowersInsight = {
  status: 'ready' | 'unready' | 'out_of_service'
  followers?: number
  targetedReaches?: number
  blocks?: number
}

/** LINEのInsight APIはJSTの日付を受け取り、前日分までしか確定していない。 */
function yesterdayJst(): string {
  const now = new Date()
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000
  const jst = new Date(jstMs)
  jst.setUTCDate(jst.getUTCDate() - 1)
  const y = jst.getUTCFullYear()
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(jst.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
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

    // pg_cron（日次、x-cron-secretのみ）と管理画面からの手動実行（JWTあり）の
    // 両方を受け付ける。meta-token-refresh と同じ二重受付の形。
    const cronSecret = Deno.env.get('SOCIAL_CRON_SECRET')
    const providedSecret = req.headers.get('x-cron-secret')
    const isCron = !!cronSecret && providedSecret === cronSecret
    if (!isCron) {
      const access = await requireAdmin(req, admin, corsHeaders)
      if (!access.ok) return access.response
    }

    const date = yesterdayJst()

    const { data: lineAccounts, error: dbError } = await admin
      .from('line_accounts')
      .select('id, store_id, channel_access_token')

    if (dbError) {
      console.error('[sync-line-friend-count] DB error:', dbError)
      return json({ error: 'Failed to load line_accounts' }, 500)
    }

    const results: Array<{ lineAccountId: string; status: string; followers?: number }> = []

    for (const account of (lineAccounts ?? []) as LineAccountRow[]) {
      try {
        const res = await fetch(
          `https://api.line.me/v2/bot/insight/followers?date=${date}`,
          { headers: { Authorization: `Bearer ${account.channel_access_token}` } },
        )

        if (!res.ok) {
          console.error(`[sync-line-friend-count] LINE API error for ${account.id}:`, res.status, await res.text())
          results.push({ lineAccountId: account.id, status: 'error' })
          continue
        }

        const insight = (await res.json()) as FollowersInsight

        if (insight.status !== 'ready') {
          results.push({ lineAccountId: account.id, status: insight.status })
          continue
        }

        const { error: upsertError } = await admin
          .from('line_friend_stats')
          .upsert(
            {
              line_account_id: account.id,
              store_id: account.store_id,
              date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
              followers: insight.followers ?? null,
              target_reaches: insight.targetedReaches ?? null,
              blocks: insight.blocks ?? null,
              fetched_at: new Date().toISOString(),
            },
            { onConflict: 'line_account_id,date' },
          )

        if (upsertError) {
          console.error(`[sync-line-friend-count] Upsert error for ${account.id}:`, upsertError)
          results.push({ lineAccountId: account.id, status: 'db_error' })
          continue
        }

        results.push({ lineAccountId: account.id, status: 'ready', followers: insight.followers })
      } catch (e) {
        console.error(`[sync-line-friend-count] Unexpected error for ${account.id}:`, e)
        results.push({ lineAccountId: account.id, status: 'error' })
      }
    }

    return json({ ok: true, date, results })
  } catch (error: unknown) {
    return safeErrorResponse(error, corsHeaders)
  }
})
