import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { selectAutoResponse } from '../_shared/auto-response.ts'
import { generateAIResponse } from '../_shared/ai-reply.ts'
import { requirePaidAiPlan, reserveAiGeneration } from '../_shared/ai-generation-policy.ts'
import { checkAiRateLimit, DEFAULT_RATE_CONFIG, simpleHash } from '../_shared/rate-limiter.ts'

export const FALLBACK = 'お答えできませんでした。お手数ですが、LINE でお問い合わせください。'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function validInput(body: unknown): body is { ec_shop_id: string; session_id: string; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  const b = body as Record<string, unknown>
  return typeof b.ec_shop_id === 'string' && UUID.test(b.ec_shop_id) &&
    typeof b.session_id === 'string' && UUID.test(b.session_id) &&
    typeof b.message === 'string' && b.message.trim().length > 0 && [...b.message].length <= 500
}
export function allowedOrigin(origin: string | null, shopUrl: string | null, development: boolean): boolean {
  return !!origin && (origin === shopUrl || (development && /^http:\/\/localhost:\d+$/.test(origin)))
}
interface Dependencies {
  admin: SupabaseClient
  apiKey: string
  development?: boolean
  rateLimit?: typeof checkAiRateLimit
  generate?: typeof generateAIResponse
}
export function createHandler({ admin, apiKey, development = false, rateLimit = checkAiRateLimit, generate = generateAIResponse }: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get('origin')
    let headers: Record<string, string> = { 'Content-Type': 'application/json', Vary: 'Origin' }
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
    if (!origin) return json({ error: 'forbidden' }, 403)
    try {
      // プリフライトには本文がないため、登録済みの店舗 URL から Origin を確認する。
      if (req.method === 'OPTIONS') {
        const { data, error } = await admin.from('ec_links').select('ec_shop_url').eq('ec_shop_url', origin).limit(1)
        if (error || !allowedOrigin(origin, data?.[0]?.ec_shop_url ?? null, development)) return json({ error: 'forbidden' }, 403)
        headers = { ...headers, 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' }
        return new Response(null, { status: 204, headers })
      }
      if (req.method !== 'POST') return json({ error: 'invalid_request' }, 400)
      let body: unknown
      try { body = await req.json() } catch { return json({ error: 'invalid_request' }, 400) }
      if (!validInput(body)) return json({ error: 'invalid_request' }, 400)
      const { data: link, error } = await admin.from('ec_links')
        .select('store_id, ec_shop_url, entitled_until, chat_enabled').eq('ec_shop_id', body.ec_shop_id).maybeSingle()
      if (error) throw error
      // 未接続も情報を公開せず unavailable にそろえる。許可 Origin 以外に CORS ヘッダーは付けない。
      if (!link) return json({ error: 'unavailable' }, 404)
      if (!allowedOrigin(origin, link.ec_shop_url, development)) return json({ error: 'forbidden' }, 403)
      headers = { ...headers, 'Access-Control-Allow-Origin': origin }
      if (!link.chat_enabled || !(link.entitled_until === 'infinity' || Date.parse(link.entitled_until) > Date.now())) return json({ error: 'unavailable' }, 404)
      const user = `web:${body.session_id}`
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
      const ipUser = `web-ip:${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`
      for (const identity of [user, ipUser]) {
        const result = await rateLimit(admin, link.store_id, identity, body.message, { ...DEFAULT_RATE_CONFIG, storeHourlyLimit: Number.POSITIVE_INFINITY }, true)
        if (!result.allowed) return json({ error: 'rate_limited' }, 429)
      }
      // 定型返信も制限対象。記録できない場合は返信生成を進めない。
      const { data: reserved, error: usageError } = await admin.rpc('reserve_ec_site_chat', {
        p_store_id: link.store_id,
        p_session_user: user,
        p_ip_user: ipUser,
        p_message_hash: simpleHash(body.message),
      })
      if (usageError) throw usageError
      if (reserved === false) return json({ error: 'rate_limited' }, 429)
      const { data: rules, error: ruleError } = await admin.from('auto_responses').select('keyword, sub_keywords, response_text').eq('store_id', link.store_id).eq('is_active', true)
      if (ruleError) throw ruleError
      const match = selectAutoResponse(body.message, rules)
      let reply = FALLBACK
      let status = 'manual_reply_needed'
      if (match && typeof match.rule.response_text === 'string') {
        reply = match.rule.response_text
        status = 'auto_replied'
      } else {
        try {
          const { data: settings, error: settingsError } = await admin.from('ai_settings').select('is_enabled, tone, persona_prompt').eq('store_id', link.store_id).maybeSingle()
          if (settingsError) throw settingsError
          if (settings?.is_enabled && apiKey) {
            await requirePaidAiPlan(admin, link.store_id)
            await reserveAiGeneration(admin, link.store_id, 'ec-site-chat')
            const generated = await generate(apiKey, body.message, settings, link.store_id, admin, true)
            if (generated.trim()) { reply = generated; status = 'ai_replied' }
          }
        } catch { /* 内部の AI エラーはお客様に公開しない。 */ }
      }
      const { data: account, error: accountError } = await admin.from('line_accounts').select('bot_id').eq('store_id', link.store_id).maybeSingle()
      if (accountError) throw accountError
      const line_url = account?.bot_id ? `https://line.me/R/ti/p/${encodeURIComponent(account.bot_id)}` : null
      const { error: logError } = await admin.from('customer_logs').insert({
        store_id: link.store_id, line_user_id: user, display_name: 'Webチャット',
        message_content: body.message, reply_content: reply, status,
      })
      if (logError) throw logError
      return json({ reply, line_url })
    } catch {
      return json({ error: 'unavailable' }, 404)
    }
  }
}
if (import.meta.main) {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } })
  Deno.serve(createHandler({ admin, apiKey: Deno.env.get('GEMINI_API_KEY') ?? '',
    development: Deno.env.get('ENVIRONMENT') === 'development' || /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url),
  }))
}
