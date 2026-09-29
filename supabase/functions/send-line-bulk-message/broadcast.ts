import { type SupabaseClient } from '@supabase/supabase-js'
import { buildRetryKey, postBroadcast, type MulticastOutcome } from '../_shared/line-multicast.ts'

/**
 * 「友だち全員」への配信（broadcast）。
 *
 * 宛先のユーザー ID を使わないので、LIFF と Messaging API のプロバイダーが違って
 * ユーザー ID が食い違う店舗でも届く。message_campaign_recipients は使わず、
 * キャンペーン 1 件で結果を記録する（宛先ごとの成否は LINE が返さない）。
 */

export type BroadcastCampaignResult =
  | { ok: true; campaignId: string; totalRecipients: number }
  | { ok: false; campaignId: string; status: number; error: string }

const MAX_ATTEMPTS = 3

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function sendBroadcastCampaign(
  admin: SupabaseClient,
  params: {
    storeId: string
    channelAccessToken: string
    messageText: string
    aiGenerated: boolean
    createdBy: string | null
    /** 友だち数の目安（LINE の統計）。分からなければ null */
    friendCount: number | null
    fetchImpl?: typeof fetch
    sleep?: (ms: number) => Promise<void>
  },
): Promise<BroadcastCampaignResult> {
  const { storeId, channelAccessToken, messageText, aiGenerated, createdBy, friendCount } = params
  const sleep = params.sleep ?? defaultSleep
  const estimated = friendCount ?? 0

  const { data: campaign, error: campaignError } = await admin
    .from('message_campaigns')
    .insert({
      store_id: storeId,
      segment_type: 'all',
      segment_params: {},
      message_text: messageText,
      ai_generated: aiGenerated,
      status: 'sending',
      total_recipients: estimated,
      created_by: createdBy,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (campaignError || !campaign) {
    console.error('message_campaigns insert:', campaignError)
    throw new Error('配信の作成に失敗しました')
  }

  // 同じキャンペーンの再試行は同じキーにして、成立済みなら LINE 側が重複を弾く
  const retryKey = await buildRetryKey(campaign.id, 0)
  let outcome: MulticastOutcome = await postBroadcast(channelAccessToken, messageText, {
    retryKey,
    fetchImpl: params.fetchImpl,
  })
  for (let attempt = 2; attempt <= MAX_ATTEMPTS && !outcome.ok && outcome.retriable; attempt++) {
    await sleep(500 * Math.pow(2, attempt - 2))
    outcome = await postBroadcast(channelAccessToken, messageText, { retryKey, fetchImpl: params.fetchImpl })
  }

  const completedAt = new Date().toISOString()
  if (outcome.ok) {
    const { error } = await admin
      .from('message_campaigns')
      .update({ status: 'completed', sent_count: estimated, failed_count: 0, completed_at: completedAt })
      .eq('id', campaign.id)
    if (error) console.error('mark broadcast completed:', error)
    return { ok: true, campaignId: campaign.id, totalRecipients: estimated }
  }

  console.error('broadcast failed:', outcome.status, outcome.error)
  const reason = `${outcome.status}: ${outcome.error}`.slice(0, 500)
  const { error } = await admin
    .from('message_campaigns')
    .update({ status: 'failed', sent_count: 0, failed_count: estimated, error: reason, completed_at: completedAt })
    .eq('id', campaign.id)
  if (error) console.error('mark broadcast failed:', error)
  return { ok: false, campaignId: campaign.id, status: outcome.status, error: outcome.error }
}
