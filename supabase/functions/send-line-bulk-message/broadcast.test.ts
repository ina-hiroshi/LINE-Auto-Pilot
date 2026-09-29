import { assert, assertEquals } from 'jsr:@std/assert@^1.0.0'
import { createFakeSupabase } from '../booking/handlers/testSupabase.ts'
import { sendBroadcastCampaign } from './broadcast.ts'

const base = {
  storeId: 'store-1',
  channelAccessToken: 'token',
  messageText: '10月のお知らせ',
  aiGenerated: false,
  createdBy: 'user-1',
  friendCount: 42,
  sleep: () => Promise.resolve(),
}

function setup() {
  return createFakeSupabase((q) =>
    q.table === 'message_campaigns' && q.method === 'insert' ? { data: { id: 'camp-1' }, error: null } : undefined
  )
}

function fakeFetch(statuses: number[]) {
  const calls: { url: string; init: RequestInit }[] = []
  const impl = (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)]
    return Promise.resolve(new Response(status === 200 ? '{}' : 'error body', { status }))
  }
  return { impl: impl as typeof fetch, calls }
}

Deno.test('broadcast: 宛先を指定せず、友だち全員へ送る', async () => {
  const fake = setup()
  const f = fakeFetch([200])
  const result = await sendBroadcastCampaign(fake.client, { ...base, fetchImpl: f.impl })

  assertEquals(result, { ok: true, campaignId: 'camp-1', totalRecipients: 42 })
  assertEquals(f.calls.length, 1)
  assertEquals(f.calls[0].url, 'https://api.line.me/v2/bot/message/broadcast')
  const body = JSON.parse(f.calls[0].init.body as string)
  assertEquals('to' in body, false)
  assertEquals(body.messages, [{ type: 'text', text: '10月のお知らせ' }])
  // 再試行で二重配信しないためのキー
  assert((f.calls[0].init.headers as Record<string, string>)['X-Line-Retry-Key'])
})

Deno.test('broadcast: キャンペーンを全友だち宛として記録し、完了にする', async () => {
  const fake = setup()
  await sendBroadcastCampaign(fake.client, { ...base, fetchImpl: fakeFetch([200]).impl })

  const insert = fake.find('message_campaigns', 'insert')[0].payload as Record<string, unknown>
  assertEquals(insert.segment_type, 'all')
  assertEquals(insert.status, 'sending')
  assertEquals(insert.total_recipients, 42)

  const update = fake.find('message_campaigns', 'update')[0].payload as Record<string, unknown>
  assertEquals(update.status, 'completed')
  assertEquals(update.sent_count, 42)
  // 宛先の表は使わない
  assertEquals(fake.find('message_campaign_recipients', 'insert').length, 0)
})

Deno.test('broadcast: 友だち数が分からなくても送れる（人数は 0 として記録）', async () => {
  const fake = setup()
  const result = await sendBroadcastCampaign(fake.client, { ...base, friendCount: null, fetchImpl: fakeFetch([200]).impl })
  assertEquals(result.ok, true)
  assertEquals((fake.find('message_campaigns', 'insert')[0].payload as Record<string, unknown>).total_recipients, 0)
})

Deno.test('broadcast: 一時的な失敗は同じキーで再試行し、成功すれば完了', async () => {
  const fake = setup()
  const f = fakeFetch([503, 200])
  const result = await sendBroadcastCampaign(fake.client, { ...base, fetchImpl: f.impl })

  assertEquals(result.ok, true)
  assertEquals(f.calls.length, 2)
  assertEquals(
    (f.calls[0].init.headers as Record<string, string>)['X-Line-Retry-Key'],
    (f.calls[1].init.headers as Record<string, string>)['X-Line-Retry-Key'],
  )
})

Deno.test('broadcast: 429（今月の上限）などは再試行せず、失敗として記録する', async () => {
  const fake = setup()
  const f = fakeFetch([429])
  const result = await sendBroadcastCampaign(fake.client, { ...base, fetchImpl: f.impl })

  assertEquals(result.ok, false)
  if (!result.ok) assertEquals(result.status, 429)
  // 429 は再試行の価値がある扱いなので 3 回まで試す
  assertEquals(f.calls.length, 3)
  const update = fake.find('message_campaigns', 'update')[0].payload as Record<string, unknown>
  assertEquals(update.status, 'failed')
  assertEquals(update.sent_count, 0)
  assertEquals(update.failed_count, 42)
})

Deno.test('broadcast: 400 は再試行しない', async () => {
  const fake = setup()
  const f = fakeFetch([400])
  const result = await sendBroadcastCampaign(fake.client, { ...base, fetchImpl: f.impl })
  assertEquals(result.ok, false)
  assertEquals(f.calls.length, 1)
})

Deno.test('broadcast: 同じキーで受け付け済み（409）なら成功として扱う', async () => {
  const fake = setup()
  const result = await sendBroadcastCampaign(fake.client, { ...base, fetchImpl: fakeFetch([409]).impl })
  assertEquals(result.ok, true)
})
