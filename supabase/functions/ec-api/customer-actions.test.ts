import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@^1.0.0'
import { createClient } from '@supabase/supabase-js'
import { customerAction, orderMessage, validOrderEvent, type OrderEvent } from './customer-actions.ts'
const id = '00000000-0000-4000-8000-000000000001'
const shop = 'https://test.itoguchi-app.jp'
const event: OrderEvent = { event_id: 'event-1', kind: 'paid', ec_customer_ref: id, order_id: id, order_number: 'A123', total: 12345, refunded_amount: 1000, order_url: `${shop}/#/account/orders/${id}`, occurred_at: '2026-11-04T00:00:00Z' }
Deno.test('EC order validation binds URL to shop and order and validates amounts', () => {
  assertEquals(validOrderEvent({ ...event }, shop), true)
  for (const patch of [{ order_url: `https://other.itoguchi-app.jp/#/account/orders/${id}` }, { total: -1 }, { total: 1.5 }, { refunded_amount: '0' }, { occurred_at: 'yesterday' }, { event_id: '' }, { event_id: 'a'.repeat(121) }, { ec_customer_ref: 'bad' }]) assertEquals(validOrderEvent({ ...event, ...patch }, shop), false)
  assertStringIncludes(orderMessage(event), '合計 12,345円')
  assertStringIncludes(orderMessage({ ...event, kind: 'shipped' }), '発送しました')
  assertStringIncludes(orderMessage({ ...event, kind: 'refunded' }), '返金の合計 1,000円')
})
Deno.test('EC events claim once, scope store, log, and release failed pushes', async t => {
  let duplicate = false, linked = true, failPush = false, failOrder = false
  let pushes = 0
  const calls: { url: URL; method: string; body: Record<string, unknown> }[] = []
  const admin = createClient('https://db.test', 'test-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)); const method = init?.method ?? 'GET'
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : {} })
    const table = url.pathname.split('/').pop()
    let body: unknown = null, status = 200
    if (table === 'ec_order_events' && method === 'POST' && duplicate) { status = 409; body = { code: '23505' } }
    if (table === 'ec_orders' && failOrder) { status = 500; body = { code: 'XX000' } }
    if (table === 'ec_customer_links' && method === 'GET') body = linked ? { customer_id: id } : null
    if (table === 'customers') body = { line_messaging_user_id: 'Ubot', line_user_id: 'Uliff', display_name: 'Customer' }
    if (table === 'line_accounts') body = { channel_access_token: 'test-token' }
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  } } })
  const original = globalThis.fetch
  globalThis.fetch = (() => { pushes++; return Promise.resolve(new Response('', { status: failPush ? 500 : 200 })) }) as typeof fetch
  const link = { id, store_id: id, ec_shop_url: shop, entitled_until: 'infinity' }
  const invoke = () => customerAction(admin, link, { ...event, action: 'order_event' })
  try {
    await t.step('success uses bot recipient and stores exact notification', async () => {
      assertEquals(await (await invoke())!.json(), { sent: true })
      assertEquals(pushes, 1)
      assertEquals(calls.find(c => c.url.pathname.endsWith('customer_logs'))?.body.reply_content, orderMessage(event))
      for (const table of ['customers', 'line_accounts', 'ec_customer_links']) assertEquals(calls.find(c => c.url.pathname.endsWith(table))?.url.searchParams.get('store_id'), `eq.${id}`)
    })
    await t.step('duplicate never pushes', async () => {
      duplicate = true
      assertEquals(await (await invoke())!.json(), { sent: false, reason: 'duplicate' }); assertEquals(pushes, 1)
      duplicate = false
    })
    await t.step('not linked and not entitled do not push', async () => {
      linked = false
      assertEquals(await (await invoke())!.json(), { sent: false, reason: 'not_linked' })
      linked = true
      assertEquals(await (await customerAction(admin, { ...link, entitled_until: null }, { ...event, action: 'order_event' }))!.json(), { sent: false, reason: 'not_entitled' })
      assertEquals(pushes, 1)
    })
    await t.step('push and order failures release claim for retry', async () => {
      for (const orderFailure of [false, true]) {
        failPush = !orderFailure; failOrder = orderFailure; calls.length = 0
        assertEquals((await invoke())!.status, 502)
        const release = calls.find(c => c.method === 'DELETE' && c.url.pathname.endsWith('ec_order_events'))
        assertEquals(release?.url.searchParams.get('store_id'), `eq.${id}`)
        assertEquals(release?.url.searchParams.get('event_id'), 'eq.event-1')
      }
      failOrder = false; failPush = false
    })
    await t.step('registration rejects bad and overly long expiry and scopes old code deletion', async () => {
      const code = { action: 'register_customer_code', code_hash: 'a'.repeat(64), ec_customer_ref: id, expires_at: new Date(Date.now() + 60_000).toISOString() }
      assertEquals((await customerAction(admin, link, { ...code, expires_at: new Date(Date.now() + 31 * 60_000).toISOString() }))!.status, 400)
      assertEquals((await customerAction(admin, link, { ...code, code_hash: 'bad' }))!.status, 400)
      calls.length = 0
      assertEquals(await (await customerAction(admin, link, code))!.json(), { ok: true })
      assertEquals(calls[0].url.searchParams.get('link_id'), `eq.${id}`)
      assertEquals(calls[0].url.searchParams.get('used_at'), 'is.null')
    })
  } finally { globalThis.fetch = original }
})
