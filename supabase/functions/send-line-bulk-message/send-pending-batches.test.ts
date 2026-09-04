import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPendingBatches } from './send-pending-batches.ts'

type Recipient = {
  batch_index: number
  line_user_id: string
  status: 'pending' | 'sending' | 'sent' | 'failed'
  error_message?: string | null
}

/**
 * message_campaign_recipients と claim/sync の RPC を模したフェイク。
 * claim は「最小の pending バッチをまとめて sending にする」という
 * SQL 側の挙動をそのまま再現する。
 */
function createFakeSupabase(recipients: Recipient[]) {
  const rows = recipients.map((row) => ({ ...row }))
  const rpcCalls: string[] = []

  const syncProgress = () => {
    const sent = rows.filter((r) => r.status === 'sent').length
    const failed = rows.filter((r) => r.status === 'failed').length
    const remaining = rows.filter((r) => r.status === 'pending' || r.status === 'sending').length
    const status = remaining > 0
      ? 'sending'
      : failed === 0
      ? 'completed'
      : sent === 0
      ? 'failed'
      : 'partial'
    return { sent_count: sent, failed_count: failed, status }
  }

  const client = {
    rpc(name: string, _args: Record<string, unknown>) {
      rpcCalls.push(name)

      if (name === 'claim_next_campaign_batch') {
        const pending = rows.filter((r) => r.status === 'pending')
        if (pending.length === 0) return Promise.resolve({ data: [], error: null })

        const target = Math.min(...pending.map((r) => r.batch_index))
        const claimed = rows.filter((r) => r.status === 'pending' && r.batch_index === target)
        for (const row of claimed) row.status = 'sending'

        return Promise.resolve({
          data: claimed.map((r) => ({ batch_index: r.batch_index, line_user_id: r.line_user_id })),
          error: null,
        })
      }

      if (name === 'sync_campaign_progress') {
        return Promise.resolve({ data: syncProgress(), error: null })
      }

      return Promise.resolve({ data: null, error: { message: `unexpected rpc ${name}` } })
    },

    from(_table: string) {
      let patch: Partial<Recipient> = {}
      const filters: { column: string; value: unknown }[] = []

      const builder = {
        update(values: Partial<Recipient>) {
          patch = values
          return builder
        },
        eq(column: string, value: unknown) {
          filters.push({ column, value })
          // 3つ目の eq (status) まで積まれた時点で実行する
          if (filters.length < 3) return builder
          const batchFilter = filters.find((f) => f.column === 'batch_index')
          const statusFilter = filters.find((f) => f.column === 'status')
          for (const row of rows) {
            if (batchFilter && row.batch_index !== batchFilter.value) continue
            if (statusFilter && row.status !== statusFilter.value) continue
            Object.assign(row, patch)
          }
          return Promise.resolve({ error: null })
        },
      }
      return builder
    },
  }

  return { client: client as unknown as SupabaseClient, rows, rpcCalls }
}

const noSleep = () => Promise.resolve()

function fetchAlways(status: number) {
  const calls: string[] = []
  const impl = ((_url: string, init?: RequestInit) => {
    calls.push(String((init?.headers as Record<string, string>)?.['X-Line-Retry-Key']))
    return Promise.resolve(new Response('{}', { status }))
  }) as unknown as typeof fetch
  return { impl, calls }
}

Deno.test('sends every batch and marks the recipients as sent', async () => {
  const { client, rows } = createFakeSupabase([
    { batch_index: 0, line_user_id: 'U1', status: 'pending' },
    { batch_index: 0, line_user_id: 'U2', status: 'pending' },
    { batch_index: 1, line_user_id: 'U3', status: 'pending' },
  ])
  const { impl, calls } = fetchAlways(200)

  const result = await sendPendingBatches(client, 'c1', 'token', 'やあ', {
    fetchImpl: impl,
    sleep: noSleep,
  })

  assertEquals(calls.length, 2)
  assertEquals(result.batchesProcessed, 2)
  assertEquals(result.sentCount, 3)
  assertEquals(result.failedCount, 0)
  assertEquals(result.status, 'completed')
  assertEquals(rows.every((r) => r.status === 'sent'), true)
})

Deno.test('marks the batch failed when LINE rejects it for good', async () => {
  const { client, rows } = createFakeSupabase([
    { batch_index: 0, line_user_id: 'U1', status: 'pending' },
  ])
  const { impl, calls } = fetchAlways(400)

  const result = await sendPendingBatches(client, 'c1', 'token', 'やあ', {
    fetchImpl: impl,
    sleep: noSleep,
  })

  // 400 は再試行しても同じなので1回で打ち切る
  assertEquals(calls.length, 1)
  assertEquals(result.status, 'failed')
  assertEquals(rows[0].status, 'failed')
  assertEquals(String(rows[0].error_message).startsWith('400:'), true)
})

Deno.test('retries a retriable failure with the same retry key', async () => {
  const { client, rows } = createFakeSupabase([
    { batch_index: 0, line_user_id: 'U1', status: 'pending' },
  ])

  const keys: string[] = []
  let attempt = 0
  const impl = ((_url: string, init?: RequestInit) => {
    attempt++
    keys.push(String((init?.headers as Record<string, string>)?.['X-Line-Retry-Key']))
    // 1回目は 429、2回目で成功
    return Promise.resolve(new Response('{}', { status: attempt === 1 ? 429 : 200 }))
  }) as unknown as typeof fetch

  const result = await sendPendingBatches(client, 'c1', 'token', 'やあ', {
    fetchImpl: impl,
    sleep: noSleep,
  })

  assertEquals(attempt, 2)
  // 再送で別のキーを使うと、1回目が実は成立していた場合に二通届く
  assertEquals(keys[0], keys[1])
  assertEquals(result.status, 'completed')
  assertEquals(rows[0].status, 'sent')
})

Deno.test('gives up after the attempt limit and records the failure', async () => {
  const { client, rows } = createFakeSupabase([
    { batch_index: 0, line_user_id: 'U1', status: 'pending' },
  ])
  const { impl, calls } = fetchAlways(500)

  const result = await sendPendingBatches(client, 'c1', 'token', 'やあ', {
    fetchImpl: impl,
    sleep: noSleep,
    maxAttempts: 3,
  })

  assertEquals(calls.length, 3)
  assertEquals(result.status, 'failed')
  assertEquals(rows[0].status, 'failed')
})

Deno.test('stops at maxBatches so long campaigns can be resumed', async () => {
  const { client, rows } = createFakeSupabase([
    { batch_index: 0, line_user_id: 'U1', status: 'pending' },
    { batch_index: 1, line_user_id: 'U2', status: 'pending' },
    { batch_index: 2, line_user_id: 'U3', status: 'pending' },
  ])
  const { impl } = fetchAlways(200)

  const result = await sendPendingBatches(client, 'c1', 'token', 'やあ', {
    fetchImpl: impl,
    sleep: noSleep,
    maxBatches: 2,
  })

  assertEquals(result.batchesProcessed, 2)
  // 残りは pending のままで、次の呼び出しが続きを送れる
  assertEquals(result.status, 'sending')
  assertEquals(rows[2].status, 'pending')
})

Deno.test('partial failure is reported as partial, not completed', async () => {
  const { client } = createFakeSupabase([
    { batch_index: 0, line_user_id: 'U1', status: 'pending' },
    { batch_index: 1, line_user_id: 'U2', status: 'pending' },
  ])

  let call = 0
  const impl = (() => {
    call++
    return Promise.resolve(new Response('{}', { status: call === 1 ? 200 : 400 }))
  }) as unknown as typeof fetch

  const result = await sendPendingBatches(client, 'c1', 'token', 'やあ', {
    fetchImpl: impl,
    sleep: noSleep,
  })

  assertEquals(result.sentCount, 1)
  assertEquals(result.failedCount, 1)
  assertEquals(result.status, 'partial')
})
