import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { getToken } from '../_shared/meta-tokens.ts'
import { buildAdsSummary, type RawAdInsightRow } from './summary.ts'

const FB_BASE = 'https://graph.facebook.com/v21.0'

// 現時点でこの広告アカウントを扱う運営は伊奈さん一人であり、マルチテナントでは
// ないため設定テーブルには持たせず定数にする（IG business account id の前例と同じ扱い）。
const AD_ACCOUNT_ID = '3610593415776553'

const LEAD_ACTION_TYPES = new Set([
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
])

type InsightRow = {
  ad_id: string
  date: string
  ad_name: string
  adset_name: string | null
  campaign_name: string | null
  effective_status: string | null
  spend: number
  impressions: number
  reach: number
  clicks: number
  ctr: number | null
  cpm: number | null
  leads: number
  cost_per_lead: number | null
  actions: unknown
}

/** Graph Marketing API から日次インサイトを取り込み、meta_ad_insights_daily へ upsert する。
 *
 * attribution window の遡及集計で確定後の数値が最大28日変わりうるため、
 * 直近28日を毎回まるごと取り直して on conflict ... do update で上書きする。
 * 「初回だけ入れて終わり」にすると数値が確定前の値のまま固定されてしまう。
 */
type GraphInsightsPage = {
  data?: Array<Record<string, unknown>>
  paging?: { next?: string }
  error?: unknown
}

async function fetchAndUpsertInsights(
  admin: SupabaseClient,
  token: string,
  sinceDate: string,
  untilDate: string,
): Promise<{ upserted: number }> {
  const fields = [
    'ad_id', 'ad_name', 'adset_name', 'campaign_name', 'effective_status',
    'spend', 'impressions', 'reach', 'clicks', 'ctr', 'cpm', 'actions',
  ].join(',')

  let cursor: string | null =
    `${FB_BASE}/act_${AD_ACCOUNT_ID}/insights?level=ad&fields=${fields}` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since: sinceDate, until: untilDate }))}` +
    `&time_increment=1&limit=500&access_token=${encodeURIComponent(token)}`

  const rows: InsightRow[] = []
  let pages = 0
  while (cursor && pages < 20) {
    pages += 1
    const res: Response = await fetch(cursor)
    const body: GraphInsightsPage = await res.json()
    if (body.error) {
      throw new Error(`Marketing API error: ${JSON.stringify(body.error)}`)
    }
    for (const entry of body.data ?? []) {
      const actions = (entry.actions as Array<{ action_type: string; value: string }> | undefined) ?? []
      const leadAction = actions.find((a) => LEAD_ACTION_TYPES.has(a.action_type))
      const leads = leadAction ? Number(leadAction.value) || 0 : 0
      const spend = Number(entry.spend ?? 0)
      const adId = String(entry.ad_id)
      rows.push({
        ad_id: adId,
        date: String(entry.date_start),
        ad_name: entry.ad_name != null ? String(entry.ad_name) : adId,
        adset_name: entry.adset_name != null ? String(entry.adset_name) : null,
        campaign_name: entry.campaign_name != null ? String(entry.campaign_name) : null,
        effective_status: entry.effective_status != null ? String(entry.effective_status) : null,
        spend,
        impressions: Number(entry.impressions ?? 0),
        reach: Number(entry.reach ?? 0),
        clicks: Number(entry.clicks ?? 0),
        ctr: entry.ctr != null ? Number(entry.ctr) : null,
        cpm: entry.cpm != null ? Number(entry.cpm) : null,
        leads,
        cost_per_lead: leads > 0 ? spend / leads : null,
        actions: entry.actions ?? null,
      })
    }
    cursor = body.paging?.next ?? null
  }

  if (rows.length === 0) return { upserted: 0 }

  const { error } = await admin
    .from('meta_ad_insights_daily')
    .upsert(rows, { onConflict: 'ad_id,date' })
  if (error) throw error

  return { upserted: rows.length }
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

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action ?? 'summary')

    // sync_now は pg_cron（日次 04:00 JST）と管理画面の手動実行の両方から呼ばれる。
    // cron は JWT を持たないため、meta-token-refresh と同じ社内共有シークレットで
    // 先に判定する。config.toml で verify_jwt=false にしてあるのはこの二重受付のため
    // （true だと cron 呼び出しがゲートウェイで 401 になる）。summary アクションは
    // 常に requireAdmin を通す。
    const cronSecret = Deno.env.get('SOCIAL_CRON_SECRET')
    const providedSecret = req.headers.get('x-cron-secret')
    const isCron = action === 'sync_now' && !!cronSecret && providedSecret === cronSecret
    if (!isCron) {
      const access = await requireAdmin(req, admin, corsHeaders)
      if (!access.ok) return access.response
    }

    if (action === 'summary') {
      const days = Math.min(Math.max(Number(body?.days ?? 30), 1), 90)
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      const { data, error } = await admin
        .from('meta_ad_insights_daily')
        .select('ad_id, date, ad_name, adset_name, campaign_name, effective_status, spend, impressions, reach, clicks, leads, cost_per_lead')
        .gte('date', since)
        .order('date', { ascending: true })
      if (error) throw error

      const rows = (data ?? []) as RawAdInsightRow[]
      const { ads, crossTab, daily } = buildAdsSummary(rows)

      const { data: cred } = await admin
        .from('meta_credentials')
        .select('scopes')
        .eq('id', 'facebook_page')
        .maybeSingle()
      const hasAdsRead = ((cred?.scopes as string[] | null) ?? []).includes('ads_read')

      return json({ ads, crossTab, daily, hasAdsRead, since })
    }

    if (action === 'sync_now') {
      const { data: cred } = await admin
        .from('meta_credentials')
        .select('scopes')
        .eq('id', 'facebook_page')
        .maybeSingle()
      const scopes = (cred?.scopes as string[] | null) ?? []
      if (!scopes.includes('ads_read')) {
        // Phase 0 の再認可がまだ済んでいない既知の状態。エラーにはせず、
        // 「準備中」として扱う（cron から呼んだときにアラート通知を出さないため）。
        return json({ ok: true, skipped: true, reason: 'ads_read スコープが未取得です。設定画面で再認可の状況を確認してください' })
      }

      const lookup = await getToken(admin, 'facebook_page')
      if (!lookup) return json({ error: 'facebook token is not configured' }, 500)

      const until = new Date().toISOString().slice(0, 10)
      const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const result = await fetchAndUpsertInsights(admin, lookup.token, since, until)
      return json({ ok: true, ...result })
    }

    return json({ error: `unknown action: ${action}` }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[marketing-ads]', message)
    return json({ error: message }, 500)
  }
})
