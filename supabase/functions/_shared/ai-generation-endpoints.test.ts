import { assertEquals } from 'jsr:@std/assert@^1.0.0'

type Handler = (req: Request) => Promise<Response>
Deno.test('AIエンドポイントはプラン・回数を確認してから外部APIを呼ぶ', async (t) => {
  const originalServe = Deno.serve
  const originalFetch = globalThis.fetch
  const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY']
  const previous = keys.map((key) => Deno.env.get(key))
  Deno.env.set(keys[0], 'https://test.supabase.co')
  Deno.env.set(keys[1], 'test-service-key')
  Deno.env.set(keys[2], 'test-gemini-key')
  let handler: Handler
  let plan = 'pro'
  let allowed: boolean | null = true
  let rpcFailure = false
  const calls: string[] = []
  Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: (fn: Handler) => { handler = fn } })
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input)
    const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
    if (url.includes('/auth/v1/user')) return json({ id: 'owner', email: 'owner@example.test' })
    if (url.includes('/rest/v1/stores')) return json({ owner_id: 'owner', name: 'store', industry: 'test' })
    if (url.includes('/rest/v1/profiles')) return json({ plan })
    if (url.includes('/rpc/reserve_ai_generation')) {
      calls.push('reserve')
      return rpcFailure ? json({ message: 'db unavailable' }, 500) : json(allowed)
    }
    if (url.includes('/rest/v1/knowledge_base')) return json([])
    if (url.includes('generativelanguage.googleapis.com')) { calls.push('gemini'); return json({ error: 'upstream failure' }, 502) }
    throw new Error(`Unexpected request: ${url}`)
  }) as typeof fetch
  try {
    for (const endpoint of ['ai-chat-preview', 'generate-campaign-message']) {
      await import(`../${endpoint}/index.ts`)
      const body = endpoint === 'ai-chat-preview'
        ? { store_id: 'store', message: 'hello', ai_settings: { tone: 'polite' } }
        : { storeId: 'store', purpose: 'hello', tone: 'polite' }
      const invoke = () => handler(new Request('https://test/functions', {
        method: 'POST', headers: { Authorization: 'Bearer test-user', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }))
      await t.step(`${endpoint}: 無料プランはGeminiを呼ばない`, async () => {
        plan = 'free'; allowed = true; rpcFailure = false; calls.length = 0
        assertEquals((await invoke()).status, 403)
        assertEquals(calls, [])
      })
      await t.step(`${endpoint}: 上限超過はGeminiを呼ばない`, async () => {
        plan = 'pro'; allowed = false; calls.length = 0
        assertEquals((await invoke()).status, 429)
        assertEquals(calls, ['reserve'])
      })
      await t.step(`${endpoint}: 記録できないときはGeminiを呼ばない`, async () => {
        rpcFailure = true; calls.length = 0
        assertEquals((await invoke()).status, 503)
        assertEquals(calls, ['reserve'])
      })
      await t.step(`${endpoint}: 生成失敗時も先に枠を記録する`, async () => {
        rpcFailure = false; allowed = true; calls.length = 0
        await invoke()
        assertEquals(calls, ['reserve', 'gemini'])
      })
    }
  } finally {
    Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: originalServe })
    globalThis.fetch = originalFetch
    keys.forEach((key, i) => previous[i] === undefined ? Deno.env.delete(key) : Deno.env.set(key, previous[i]!))
  }
})
