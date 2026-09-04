import { assertEquals, assertNotEquals } from 'jsr:@std/assert@^1.0.0'
import {
  buildRetryKey,
  chunkRecipients,
  MULTICAST_BATCH_SIZE,
  postMulticast,
} from './line-multicast.ts'

function fakeFetch(responder: (init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = []
  const impl = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return Promise.resolve(responder(init ?? {}))
  }) as unknown as typeof fetch
  return { impl, calls }
}

Deno.test('chunkRecipients splits at the multicast limit', () => {
  const ids = Array.from({ length: 1001 }, (_, i) => `U${i}`)
  const batches = chunkRecipients(ids)

  assertEquals(batches.length, 3)
  assertEquals(batches[0].length, MULTICAST_BATCH_SIZE)
  assertEquals(batches[1].length, MULTICAST_BATCH_SIZE)
  assertEquals(batches[2].length, 1)
  assertEquals(batches.flat().length, ids.length)
})

Deno.test('buildRetryKey is stable per batch and differs across batches', async () => {
  const campaignId = '11111111-1111-1111-1111-111111111111'

  const first = await buildRetryKey(campaignId, 0)
  const again = await buildRetryKey(campaignId, 0)
  const other = await buildRetryKey(campaignId, 1)

  // 同じバッチの再送で同じキーが出ないと、LINE 側の重複排除が効かず二重配信になる
  assertEquals(first, again)
  assertNotEquals(first, other)
  assertEquals(/^[0-9a-f-]{36}$/.test(first), true)
})

Deno.test('postMulticast sends the recipients and the retry key', async () => {
  const { impl, calls } = fakeFetch(() => new Response('{}', { status: 200 }))

  const result = await postMulticast('token', ['U1', 'U2'], 'こんにちは', {
    retryKey: 'abc',
    fetchImpl: impl,
  })

  assertEquals(result, { ok: true, alreadyAccepted: false })
  assertEquals(calls.length, 1)

  const headers = calls[0].init.headers as Record<string, string>
  assertEquals(headers['X-Line-Retry-Key'], 'abc')
  assertEquals(headers.Authorization, 'Bearer token')

  const body = JSON.parse(String(calls[0].init.body))
  assertEquals(body.to, ['U1', 'U2'])
  assertEquals(body.messages, [{ type: 'text', text: 'こんにちは' }])
})

Deno.test('postMulticast treats 409 as already delivered', async () => {
  const { impl } = fakeFetch(() => new Response('conflict', { status: 409 }))

  const result = await postMulticast('token', ['U1'], 'やあ', { fetchImpl: impl })

  // 409 は「同じリトライキーを受付済み」。失敗にすると届いた配信を失敗として記録してしまう
  assertEquals(result, { ok: true, alreadyAccepted: true })
})

Deno.test('postMulticast marks 429 and 5xx as retriable, 4xx as not', async () => {
  for (const [status, retriable] of [[429, true], [500, true], [503, true], [400, false], [401, false]] as const) {
    const { impl } = fakeFetch(() => new Response('err', { status }))
    const result = await postMulticast('token', ['U1'], 'やあ', { fetchImpl: impl })

    assertEquals(result.ok, false)
    if (!result.ok) {
      assertEquals(result.status, status)
      assertEquals(result.retriable, retriable)
    }
  }
})

Deno.test('postMulticast treats network failures as retriable', async () => {
  const impl = (() => Promise.reject(new Error('boom'))) as unknown as typeof fetch

  const result = await postMulticast('token', ['U1'], 'やあ', { fetchImpl: impl })

  assertEquals(result.ok, false)
  if (!result.ok) {
    assertEquals(result.retriable, true)
    assertEquals(result.error, 'boom')
  }
})

Deno.test('postMulticast refuses empty or oversized batches without calling LINE', async () => {
  const { impl, calls } = fakeFetch(() => new Response('{}', { status: 200 }))

  const empty = await postMulticast('token', [], 'やあ', { fetchImpl: impl })
  const oversized = await postMulticast(
    'token',
    Array.from({ length: MULTICAST_BATCH_SIZE + 1 }, (_, i) => `U${i}`),
    'やあ',
    { fetchImpl: impl },
  )

  assertEquals(empty.ok, false)
  assertEquals(oversized.ok, false)
  assertEquals(calls.length, 0)
})
