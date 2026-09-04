import { type SupabaseClient } from '@supabase/supabase-js'
import { buildRetryKey, postMulticast } from '../_shared/line-multicast.ts'

/**
 * キャンペーンの未送信バッチを順に送る。
 *
 * 同期送信（send-line-bulk-message）と cron ドレインの両方がここを呼ぶ。
 * 送信経路を二重に実装すると、リトライやステータス確定の条件が片方だけ
 * 直されて食い違うため、必ずこのモジュールを共有する。
 */

export type SendPendingBatchesOptions = {
  fetchImpl?: typeof fetch
  /** 1 回の呼び出しで処理するバッチ数の上限（Edge Function のタイムアウト対策） */
  maxBatches?: number
  /** 再試行の最大回数（初回を含む） */
  maxAttempts?: number
  sleep?: (ms: number) => Promise<void>
}

export type SendPendingBatchesResult = {
  batchesProcessed: number
  sentCount: number
  failedCount: number
  status: string
}

const DEFAULT_MAX_BATCHES = 40
const DEFAULT_MAX_ATTEMPTS = 3

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function sendPendingBatches(
  admin: SupabaseClient,
  campaignId: string,
  channelAccessToken: string,
  messageText: string,
  options: SendPendingBatchesOptions = {},
): Promise<SendPendingBatchesResult> {
  const maxBatches = options.maxBatches ?? DEFAULT_MAX_BATCHES
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const sleep = options.sleep ?? defaultSleep

  let batchesProcessed = 0

  while (batchesProcessed < maxBatches) {
    const { data: claimed, error: claimError } = await admin.rpc('claim_next_campaign_batch', {
      p_campaign_id: campaignId,
    })

    if (claimError) {
      console.error('claim_next_campaign_batch:', claimError)
      break
    }

    const rows = (claimed ?? []) as { batch_index: number; line_user_id: string }[]
    // 0 件は「完了」とは限らない。別のワーカーが処理中のバッチを
    // skip locked で飛ばした場合も 0 件になる。完了判定は
    // sync_campaign_progress が配信先テーブルを数えて行う。
    if (rows.length === 0) break

    const batchIndex = rows[0].batch_index
    const recipients = rows.map((row) => row.line_user_id)
    const retryKey = await buildRetryKey(campaignId, batchIndex)

    let outcome = await postMulticast(channelAccessToken, recipients, messageText, {
      retryKey,
      fetchImpl: options.fetchImpl,
    })

    for (let attempt = 2; attempt <= maxAttempts && !outcome.ok && outcome.retriable; attempt++) {
      // 同じリトライキーで送り直す。前回のリクエストが実は成立していた場合、
      // LINE 側が 409 を返して二通目の配信を防いでくれる。
      await sleep(500 * Math.pow(2, attempt - 2))
      outcome = await postMulticast(channelAccessToken, recipients, messageText, {
        retryKey,
        fetchImpl: options.fetchImpl,
      })
    }

    if (outcome.ok) {
      const { error } = await admin
        .from('message_campaign_recipients')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
        .eq('campaign_id', campaignId)
        .eq('batch_index', batchIndex)
        .eq('status', 'sending')
      if (error) console.error('mark sent:', error)
    } else {
      console.error(`multicast failed (batch ${batchIndex}):`, outcome.status, outcome.error)
      const { error } = await admin
        .from('message_campaign_recipients')
        .update({ status: 'failed', error_message: `${outcome.status}: ${outcome.error}`.slice(0, 500) })
        .eq('campaign_id', campaignId)
        .eq('batch_index', batchIndex)
        .eq('status', 'sending')
      if (error) console.error('mark failed:', error)
    }

    batchesProcessed++
  }

  const { data: progress, error: progressError } = await admin.rpc('sync_campaign_progress', {
    p_campaign_id: campaignId,
  })

  if (progressError) {
    console.error('sync_campaign_progress:', progressError)
    return { batchesProcessed, sentCount: 0, failedCount: 0, status: 'sending' }
  }

  const campaign = (Array.isArray(progress) ? progress[0] : progress) as
    | { sent_count: number; failed_count: number; status: string }
    | null

  return {
    batchesProcessed,
    sentCount: campaign?.sent_count ?? 0,
    failedCount: campaign?.failed_count ?? 0,
    status: campaign?.status ?? 'sending',
  }
}
