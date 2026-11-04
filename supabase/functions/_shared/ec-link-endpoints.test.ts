import { assertEquals } from 'jsr:@std/assert@^1.0.0'

type Handler = (req: Request) => Promise<Response>

Deno.test('EC endpoints authenticate callers and scope mutations', async t => {
  const originalServe = Deno.serve
  const originalFetch = globalThis.fetch
  const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ITOGUCHI_EC_SHARED_SECRET']
  const previous = keys.map(key => Deno.env.get(key))
  Deno.env.set(keys[0], 'https://test.supabase.co')
  Deno.env.set(keys[1], 'test-service-key')
  Deno.env.set(keys[2], 'test-shared-secret')
  let handler: Handler
  let exchangeError = 'invalid_code'
  let userId = 'owner'
  let linked = false
  const updates: unknown[] = []
  const calls: string[] = []
  const storeId = '00000000-0000-4000-8000-000000000001'
  Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: (fn: Handler) => { handler = fn } })
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push(url)
    const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    }))
    if (url.includes('/auth/v1/user')) return json({ id: userId })
    if (url.includes('/rest/v1/stores')) return json({ owner_id: 'owner' })
    if (url.includes('/rest/v1/ec_links')) {
      if (init?.method === 'PATCH') { updates.push(JSON.parse(String(init.body))); return json(null) }
      return json(linked ? { id: 'link', store_id: storeId } : null)
    }
    if (url.includes('/rpc/exchange_ec_link')) return exchangeError
      ? json({ code: 'P0001', message: exchangeError }, 400)
      : json('Test store')
    if (url.includes('/rpc/issue_ec_link_code')) return json(null)
    throw new Error('Unexpected database call')
  }) as typeof fetch
  const invoke = (body: unknown, headers: Record<string, string> = {}) => handler(new Request('https://test/functions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  }))
  try {
    await import('../ec-api/index.ts')
    const exchange = { action: 'exchange', code: 'ABCDEFGH', ec_shop_id: storeId,
      ec_shop_url: 'https://test.itoguchi-app.jp', ec_shop_name: 'Shop' }
    const secret = { 'x-ec-shared-secret': 'test-shared-secret' }
    await t.step('missing or different shared secret is rejected before database access', async () => {
      const headerCases: Record<string, string>[] = [{}, { 'x-ec-shared-secret': 'wrong' }]
      for (const headers of headerCases) {
        calls.length = 0
        const response = await invoke(exchange, headers)
        assertEquals(response.status, 401)
        assertEquals(await response.json(), { error: 'unauthorized' })
        assertEquals(calls, [])
      }
    })
    await t.step('unknown token is rejected', async () => {
      const response = await invoke({ action: 'unlink' }, { ...secret, Authorization: `Bearer ${'a'.repeat(64)}` })
      assertEquals(response.status, 401)
      assertEquals(await response.json(), { error: 'unauthorized' })
    })
    await t.step('invalid, expired and consumed codes use the same error', async () => {
      exchangeError = 'invalid_code'
      const response = await invoke(exchange, secret)
      assertEquals(response.status, 400)
      assertEquals(await response.json(), { error: 'invalid_code' })
    })
    await t.step('existing linkage returns conflict', async () => {
      exchangeError = 'already_linked'
      const response = await invoke(exchange, secret)
      assertEquals(response.status, 409)
      assertEquals(await response.json(), { error: 'already_linked' })
    })
    await t.step('exchange returns random token and store name', async () => {
      exchangeError = ''
      const response = await invoke(exchange, secret)
      assertEquals(response.status, 200)
      const result = await response.json()
      assertEquals(/^[a-f0-9]{64}$/.test(result.token), true)
      assertEquals(result.store_name, 'Test store')
    })
    await t.step('entitlement accepts optional boolean chat_enabled and preserves it when omitted', async () => {
      linked = true
      const headers = { ...secret, Authorization: `Bearer ${'a'.repeat(64)}` }
      for (const chat_enabled of [true, false]) {
        const response = await invoke({ action: 'entitlement', entitled: true, until: null, chat_enabled }, headers)
        assertEquals(response.status, 200)
        assertEquals(updates.at(-1), { entitled_until: 'infinity', chat_enabled })
      }
      const before = updates.length
      assertEquals((await invoke({ action: 'entitlement', entitled: true, until: null, chat_enabled: 'true' }, headers)).status, 400)
      assertEquals(updates.length, before)
      assertEquals((await invoke({ action: 'entitlement', entitled: true, until: null }, headers)).status, 200)
      assertEquals(updates.at(-1), { entitled_until: 'infinity' })
      linked = false
    })
    await import('../ec-link-code/index.ts')
    await t.step('other owner and admin cannot issue or unlink for a store', async () => {
      for (const other of ['other-owner', 'admin']) {
        userId = other
        for (const action of ['issue', 'unlink']) {
          calls.length = 0
          const response = await invoke({ action, storeId }, { Authorization: 'Bearer test-user' })
          assertEquals(response.status, 403)
          assertEquals(await response.json(), { error: 'forbidden' })
          assertEquals(calls.some(url => url.includes('/rpc/') || url.includes('/ec_links')), false)
        }
      }
    })
    await t.step('owner can issue a code through the atomic RPC', async () => {
      userId = 'owner'
      calls.length = 0
      const response = await invoke({ action: 'issue', storeId }, { Authorization: 'Bearer test-user' })
      assertEquals(response.status, 200)
      const result = await response.json()
      assertEquals(/^[A-HJKMNP-Z2-9]{8}$/.test(result.code), true)
      assertEquals(Number.isFinite(Date.parse(result.expires_at)), true)
      assertEquals(calls.some(url => url.includes('/rpc/issue_ec_link_code')), true)
    })
  } finally {
    Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: originalServe })
    globalThis.fetch = originalFetch
    keys.forEach((key, i) => previous[i] === undefined ? Deno.env.delete(key) : Deno.env.set(key, previous[i]!))
  }
})
