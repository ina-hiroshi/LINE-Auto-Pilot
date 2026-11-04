import { assert, assertEquals } from 'jsr:@std/assert@^1.0.0'
import { simpleHash } from '../_shared/rate-limiter.ts'
import { createFakeSupabase } from '../booking/handlers/testSupabase.ts'
import { allowedOrigin, createHandler, FALLBACK, validInput } from './index.ts'
const id = '12345678-1234-1234-1234-123456789abc'
const origin = 'https://shop.itoguchi-app.jp'
const input = { ec_shop_id: id, session_id: id, message: '営業時間を教えてください' }
function setup(options: { missing?: boolean; expired?: boolean; disabled?: boolean; limited?: number; usageError?: boolean; ai?: boolean } = {}) {
  const fake = createFakeSupabase(q => {
    if (q.table === 'ec_links') return { data: options.missing ? null : q.cardinality === 'many' ? [{ ec_shop_url: origin }] : { store_id: 'store', ec_shop_url: origin, chat_enabled: !options.disabled, entitled_until: options.expired ? '2020-01-01' : 'infinity' }, error: null }
    if (q.table === 'auto_responses') return { data: options.ai ? [] : [{ keyword: '営業時間', response_text: '10時からです。' }], error: null }
    if (q.table === 'ai_settings') return { data: { is_enabled: true }, error: null }
    if (q.table === 'line_accounts') return { data: { bot_id: '@shop' }, error: null }
    if (q.table === 'ai_rate_limits' && options.usageError) return { data: null, error: { message: 'failed' } }
    return undefined
  })
  const identities: string[] = []
  const handler = createHandler({ admin: fake.client, apiKey: 'test', rateLimit: (_admin, _store, user) => {
    identities.push(user)
    return Promise.resolve(options.limited === identities.length ? { allowed: false, reason: 'user_cooldown' } : { allowed: true })
  } })
  const run = (body: unknown = input, requestOrigin: string | null = origin, method = 'POST') => handler(new Request('http://test', {
    method, headers: { ...(requestOrigin ? { Origin: requestOrigin } : {}), 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.1, 10.0.0.1' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  }))
  return { fake, identities, run }
}
Deno.test('CORS は完全一致のみ。localhost は開発時のみ', () => {
  assert(allowedOrigin(origin, origin, false))
  for (const value of [null, origin + '.evil', origin + '/', 'http://localhost:3000']) assertEquals(allowedOrigin(value, origin, false), false)
  assert(allowedOrigin('http://localhost:3000', null, true))
  assertEquals(allowedOrigin('http://localhost.evil:3000', null, true), false)
})
Deno.test('入力: UUID と1〜500字の本文を検証', () => {
  assert(validInput(input))
  assert(validInput({ ...input, message: 'あ'.repeat(500) }))
  for (const body of [null, [], {}, { ...input, session_id: 'bad' }, { ...input, ec_shop_id: 'bad' }, { ...input, message: '' }, { ...input, message: ' ' }, { ...input, message: 'あ'.repeat(501) }]) assertEquals(validInput(body), false)
})
Deno.test('Origin なし・異なる Origin は403で CORS なし、OPTIONSも店舗照合', async () => {
  const s = setup()
  for (const value of [null, 'https://evil.example']) {
    const response = await s.run(input, value)
    assertEquals(response.status, 403)
    assertEquals(response.headers.get('Access-Control-Allow-Origin'), null)
  }
  const preflight = await s.run(undefined, origin, 'OPTIONS')
  assertEquals(preflight.status, 204)
  assertEquals(preflight.headers.get('Access-Control-Allow-Origin'), origin)
  assertEquals((await s.run(undefined, 'https://evil.example', 'OPTIONS')).status, 403)
})
Deno.test('不正入力は400', async () => { assertEquals((await setup().run({})).status, 400) })
for (const option of ['missing', 'expired', 'disabled'] as const) {
  Deno.test(`unavailable: ${option}`, async () => {
    const s = setup({ [option]: true }); const res = await s.run()
    assertEquals(res.status, 404); assertEquals(await res.json(), { error: 'unavailable' }); assertEquals(s.identities.length, 0)
  })
}
for (const limited of [1, 2]) Deno.test(`rate_limited: ${limited === 1 ? 'session' : 'IP'}`, async () => {
  const s = setup({ limited }); const res = await s.run()
  assertEquals(res.status, 429); assertEquals(await res.json(), { error: 'rate_limited' })
  assertEquals(s.fake.find('customer_logs', 'insert').length, 0)
})
Deno.test('定型返信: 2種の制限記録、LINE URL、会話ログを保存', async () => {
  const s = setup(); const res = await s.run()
  assertEquals(res.status, 200)
  assertEquals(await res.json(), { reply: '10時からです。', line_url: 'https://line.me/R/ti/p/%40shop' })
  assertEquals(s.identities[0], `web:${id}`)
  assert(/^web-ip:[0-9a-f]{64}$/.test(s.identities[1]))
  assertEquals(s.fake.find('ai_rate_limits', 'insert')[0].payload, [
    { store_id: 'store', line_user_id: s.identities[0], message_hash: simpleHash(input.message) },
    { store_id: 'store', line_user_id: s.identities[1], message_hash: simpleHash(input.message) },
  ])
  assertEquals(s.fake.find('customer_logs', 'insert')[0].payload, { store_id: 'store', line_user_id: `web:${id}`, display_name: 'Webチャット', message_content: input.message, reply_content: '10時からです。', status: 'auto_replied' })
})
Deno.test('使用回数を記録できなければ返信しない', async () => { assertEquals((await setup({ usageError: true }).run()).status, 404) })
Deno.test('AI失敗の詳細は返さず手動対応の文を保存', async () => {
  const s = setup({ ai: true }); const res = await s.run()
  assertEquals((await res.json()).reply, FALLBACK)
  assertEquals((s.fake.find('customer_logs', 'insert')[0].payload as Record<string, unknown>).status, 'manual_reply_needed')
})
