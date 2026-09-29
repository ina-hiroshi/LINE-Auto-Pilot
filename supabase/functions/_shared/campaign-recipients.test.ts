import { assertEquals } from 'jsr:@std/assert@1'
import { createFakeSupabase } from '../booking/handlers/testSupabase.ts'
import { loadFriendCount, loadRecipientContext, resolveRecipients, type SegmentRow } from './campaign-recipients.ts'

const rows: SegmentRow[] = [
  { customer_id: 'c1', line_user_id: 'U-liff-1', display_name: '山田' },
  { customer_id: 'c2', line_user_id: 'U-liff-2', display_name: '佐藤' },
  { customer_id: 'c3', line_user_id: 'U-liff-3', display_name: null },
]

Deno.test('resolveRecipients: 紐付け済みは Bot 側の ID を宛先にする', () => {
  const result = resolveRecipients(rows, new Map([['c1', 'U-bot-1']]), false)
  assertEquals(result.deliverable, [{ customer_id: 'c1', line_user_id: 'U-bot-1', display_name: '山田' }])
  // 別体系の店舗で未紐付けの 2 人は届かない
  assertEquals(result.undeliverable, 2)
})

Deno.test('resolveRecipients: LIFF 側の ID は、別体系の店舗では絶対に宛先にしない', () => {
  const result = resolveRecipients(rows, new Map(), false)
  assertEquals(result.deliverable, [])
  assertEquals(result.undeliverable, 3)
})

Deno.test('resolveRecipients: 判定前（null）の店舗でも、LIFF 側の ID を使わない', () => {
  // 未判定のまま LIFF 側の ID で送ると、届かないのに「送信済み」になる
  const result = resolveRecipients(rows, new Map(), null)
  assertEquals(result.deliverable, [])
  assertEquals(result.undeliverable, 3)
})

Deno.test('resolveRecipients: 同じ体系の店舗では、未紐付けの顧客も LIFF 側の ID で配信できる', () => {
  const result = resolveRecipients(rows, new Map([['c1', 'U-bot-1']]), true)
  assertEquals(result.deliverable.map((r) => r.line_user_id), ['U-bot-1', 'U-liff-2', 'U-liff-3'])
  assertEquals(result.undeliverable, 0)
})

Deno.test('resolveRecipients: 同じ宛先には一度だけ送る', () => {
  const result = resolveRecipients(
    rows,
    new Map([['c1', 'U-same'], ['c2', 'U-same']]),
    false,
  )
  assertEquals(result.deliverable.length, 1)
  assertEquals(result.undeliverable, 1)
})

Deno.test('loadRecipientContext: 紐付け済みの顧客と、店舗の体系を読む', async () => {
  const fake = createFakeSupabase((q) => {
    if (q.table === 'customers') {
      return { data: [{ id: 'c1', line_messaging_user_id: 'U-bot-1' }], error: null }
    }
    if (q.table === 'stores') return { data: { line_ids_aligned: false }, error: null }
    return undefined
  })
  const ctx = await loadRecipientContext(fake.client, 'store-1')
  assertEquals(ctx.messagingIds.get('c1'), 'U-bot-1')
  assertEquals(ctx.aligned, false)
  // 店舗で絞っている
  assertEquals(fake.filterValue(fake.find('customers')[0], 'store_id'), 'store-1')
})

Deno.test('loadRecipientContext: 1000 件を超えてもページ送りで全件読む', async () => {
  let page = 0
  const fake = createFakeSupabase((q) => {
    if (q.table === 'customers') {
      page++
      const size = page === 1 ? 1000 : 3
      return {
        data: Array.from({ length: size }, (_, i) => ({ id: `c${page}-${i}`, line_messaging_user_id: `U${page}-${i}` })),
        error: null,
      }
    }
    if (q.table === 'stores') return { data: { line_ids_aligned: null }, error: null }
    return undefined
  })
  const ctx = await loadRecipientContext(fake.client, 'store-1')
  assertEquals(ctx.messagingIds.size, 1003)
  assertEquals(ctx.aligned, null)
})

Deno.test('loadFriendCount: 最新の友だち数。無ければ null', async () => {
  const withStats = createFakeSupabase((q) =>
    q.table === 'line_friend_stats' ? { data: { followers: 42 }, error: null } : undefined
  )
  assertEquals(await loadFriendCount(withStats.client, 'store-1'), 42)

  const none = createFakeSupabase()
  assertEquals(await loadFriendCount(none.client, 'store-1'), null)
})
