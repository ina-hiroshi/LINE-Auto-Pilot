import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { ClientVisibleError, clientVisibleErrorResponse, safeErrorResponse } from '../_shared/error-utils.ts'
import { requireStoreAccess } from '../_shared/store-access.ts'
import { MULTICAST_BATCH_SIZE } from '../_shared/line-multicast.ts'
import { sendPendingBatches } from './send-pending-batches.ts'

/** LINE のテキストメッセージ上限 */
const MAX_MESSAGE_LENGTH = 5000

/**
 * 1 回の呼び出しで処理するバッチ数の上限。
 * multicast 1 回あたり最大 500 宛先なので 40 バッチ = 20,000 宛先。
 */
const MAX_BATCHES_PER_CALL = 40

/**
 * 1 配信の宛先数の上限。
 *
 * この関数は同期的に送り切る。上限を超える配信を受け付けて「後で送ります」と
 * 返すには、実際に後で送る仕組み（常駐ジョブ）が要る。それが無い状態で
 * 受け付けるのが一番まずい: 画面上は「配信中」のまま永久に止まり、
 * 店舗側は送信済みだと思い込む。送れない量は、送る前に断る。
 */
const MAX_RECIPIENTS = MAX_BATCHES_PER_CALL * MULTICAST_BATCH_SIZE

/** 再開時に「もう動いていない」と見なすまでの待ち時間（分） */
const RESUME_STALE_MINUTES = 2

const SEGMENT_TYPES = [
  'all',
  'visited',
  'prospective',
  'dormant',
  'recent',
  'repeat',
  'menu',
  'staff',
  'high_spender',
  'manual',
] as const

type SegmentCustomer = {
  customer_id: string
  line_user_id: string
  display_name: string | null
}

type QuotaStatus =
  /** 無制限プラン。残量という概念がない */
  | { kind: 'unlimited' }
  | { kind: 'limited'; remaining: number }
  /** LINE 側の障害などで残量を読めなかった */
  | { kind: 'unknown' }

/**
 * LINE の月間配信数の残量を確認する。
 *
 * 「無制限だから残量が無い」と「確認できなかった」を区別して返す。
 * 一緒くたにすると、LINE の一時障害のときに数千通の配信をそのまま
 * 通してしまい、店舗が意図せず従量課金の枠を使い切ることになる。
 */
async function fetchQuotaStatus(token: string): Promise<QuotaStatus> {
  try {
    const [quotaRes, consumptionRes] = await Promise.all([
      fetch('https://api.line.me/v2/bot/message/quota', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('https://api.line.me/v2/bot/message/quota/consumption', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])

    if (!quotaRes.ok || !consumptionRes.ok) {
      console.error('LINE quota API error', quotaRes.status, consumptionRes.status)
      return { kind: 'unknown' }
    }

    const quota = await quotaRes.json()
    const consumption = await consumptionRes.json()

    if (quota.type === 'none') return { kind: 'unlimited' }
    if (typeof quota.value !== 'number') return { kind: 'unknown' }

    return { kind: 'limited', remaining: quota.value - (consumption.totalUsage ?? 0) }
  } catch (e) {
    console.error('LINE quota fetch failed:', e)
    return { kind: 'unknown' }
  }
}

/**
 * 中断されたキャンペーンの続きを送る。
 *
 * 送信中に Edge Function が時間切れになったり通信が切れたりすると、宛先が
 * pending / sending のまま残り、画面には「配信中」が出たままになる。
 * 常駐ジョブは持たないので、店舗が結果画面から明示的に再開できるようにする。
 */
async function resumeCampaign(
  admin: SupabaseClient,
  storeId: string,
  campaignId: string,
  channelAccessToken: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const { data: campaign } = await admin
    .from('message_campaigns')
    .select('id, store_id, message_text, status')
    .eq('id', campaignId)
    .eq('store_id', storeId)
    .maybeSingle()

  if (!campaign) {
    throw new ClientVisibleError('配信が見つかりません', 404)
  }
  if (campaign.status === 'completed') {
    throw new ClientVisibleError('この配信はすでに完了しています', 400)
  }

  // 送信処理が落ちて sending のまま取り残された宛先を pending に戻してから再開する。
  //
  // 待ち時間を長く取ると再開ボタンが何も起こさないボタンになる。中断の典型は
  // Edge Function の時間切れ（数十秒〜150秒）で、取り残された行の claimed_at は
  // 「たった今」に近い。一方 0 分にはできない: 最初の送信がまだ走っている最中に
  // 別タブから再開されると、処理中のバッチを奪って二重送信になる。
  // 1 バッチの送信は再試行を含めても十数秒で終わるので、その上限を超える
  // 値として STALE_MINUTES を置く。
  const { error: reclaimError } = await admin.rpc('reclaim_stale_campaign_batches', {
    p_campaign_id: campaign.id,
    p_stale_minutes: RESUME_STALE_MINUTES,
  })
  if (reclaimError) console.error('reclaim_stale_campaign_batches:', reclaimError)

  const result = await sendPendingBatches(
    admin,
    campaign.id,
    channelAccessToken,
    campaign.message_text,
    { maxBatches: MAX_BATCHES_PER_CALL },
  )

  // 1 バッチも処理できず、それでも未送信が残っている = まだ回収できない
  // 送信中の宛先がある。成功として返すと「押しても何も起きない」ボタンに
  // 見えるので、待ってから試すよう明示する。
  if (result.batchesProcessed === 0 && result.status === 'sending') {
    throw new ClientVisibleError(
      `前回の送信処理がまだ実行中の可能性があります。${RESUME_STALE_MINUTES}分ほどおいてから、もう一度お試しください。`,
      409,
    )
  }

  return new Response(
    JSON.stringify({
      campaignId: campaign.id,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      status: result.status,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { storeId, segmentType, segmentParams, messageText, aiGenerated, resumeCampaignId } =
      await req.json()

    if (!storeId) {
      throw new ClientVisibleError('店舗が指定されていません', 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const access = await requireStoreAccess(req, storeId, admin, corsHeaders)
    if (!access.ok) return access.response

    const { data: lineAccount } = await admin
      .from('line_accounts')
      .select('channel_access_token')
      .eq('store_id', storeId)
      .maybeSingle()

    const channelAccessToken = lineAccount?.channel_access_token
    if (!channelAccessToken) {
      throw new ClientVisibleError(
        'LINE公式アカウントが連携されていません。LINE設定からチャネルアクセストークンを登録してください。',
        400,
      )
    }

    // 送信が途中で中断されたキャンペーンの続きを送る。
    // 宛先は登録済みなので、セグメント抽出も宛先の作り直しもしない。
    if (resumeCampaignId) {
      return await resumeCampaign(admin, storeId, resumeCampaignId, channelAccessToken, corsHeaders)
    }

    if (!SEGMENT_TYPES.includes(segmentType)) {
      throw new ClientVisibleError('配信対象の指定が不正です', 400)
    }

    const text = typeof messageText === 'string' ? messageText.trim() : ''
    if (!text) {
      throw new ClientVisibleError('メッセージを入力してください', 400)
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      throw new ClientVisibleError(
        `メッセージが長すぎます（${MAX_MESSAGE_LENGTH}文字まで）`,
        400,
      )
    }

    const { data: segmentRows, error: segmentError } = await admin.rpc('get_segment_customers', {
      p_store_id: storeId,
      p_segment_type: segmentType,
      p_params: segmentParams ?? {},
    })

    if (segmentError) {
      console.error('get_segment_customers:', segmentError)
      throw new ClientVisibleError('配信対象の抽出に失敗しました', 500)
    }

    const recipients = (segmentRows ?? []) as SegmentCustomer[]
    if (recipients.length === 0) {
      throw new ClientVisibleError('この条件に当てはまるお客様がいません', 400)
    }
    if (recipients.length > MAX_RECIPIENTS) {
      throw new ClientVisibleError(
        `一度に配信できるのは${MAX_RECIPIENTS.toLocaleString('ja-JP')}名までです（今回の対象は${recipients.length.toLocaleString('ja-JP')}名）。配信対象を絞り込んでください。`,
        400,
      )
    }

    const quota = await fetchQuotaStatus(channelAccessToken)
    if (quota.kind === 'limited' && quota.remaining < recipients.length) {
      // 途中まで送ると、再送時にどこまで届いたか分からなくなる。送る前に止める。
      throw new ClientVisibleError(
        `今月の配信可能数が足りません（残り${quota.remaining}通・配信対象${recipients.length}名）。対象を絞るか、翌月まで待つか、LINE公式アカウントのプランをご確認ください。`,
        400,
      )
    }
    if (quota.kind === 'unknown') {
      throw new ClientVisibleError(
        'LINEの配信可能数を確認できませんでした。時間をおいて再度お試しください。',
        503,
      )
    }

    const { data: campaign, error: campaignError } = await admin
      .from('message_campaigns')
      .insert({
        store_id: storeId,
        segment_type: segmentType,
        segment_params: segmentParams ?? {},
        message_text: text,
        ai_generated: aiGenerated === true,
        status: 'draft',
        total_recipients: recipients.length,
        created_by: access.userId,
      })
      .select('id')
      .single()

    if (campaignError || !campaign) {
      console.error('message_campaigns insert:', campaignError)
      throw new ClientVisibleError('配信の作成に失敗しました', 500)
    }

    const rows = recipients.map((recipient, index) => ({
      campaign_id: campaign.id,
      customer_id: recipient.customer_id,
      line_user_id: recipient.line_user_id,
      batch_index: Math.floor(index / MULTICAST_BATCH_SIZE),
    }))

    // 宛先の登録が終わるまで status は draft のままにする。
    // 途中で失敗した状態を sending にすると、ドレインが「宛先ゼロの
    // 送信中キャンペーン」を完了扱いにしてしまう。
    for (let i = 0; i < rows.length; i += 1000) {
      const { error: recipientError } = await admin
        .from('message_campaign_recipients')
        .insert(rows.slice(i, i + 1000))

      if (recipientError) {
        console.error('message_campaign_recipients insert:', recipientError)
        await admin
          .from('message_campaigns')
          .update({ status: 'failed', error: '配信先の登録に失敗しました' })
          .eq('id', campaign.id)
        throw new ClientVisibleError('配信先の登録に失敗しました', 500)
      }
    }

    await admin
      .from('message_campaigns')
      .update({ status: 'sending', started_at: new Date().toISOString() })
      .eq('id', campaign.id)

    const result = await sendPendingBatches(admin, campaign.id, channelAccessToken, text, {
      maxBatches: MAX_BATCHES_PER_CALL,
    })

    return new Response(
      JSON.stringify({
        campaignId: campaign.id,
        totalRecipients: recipients.length,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        status: result.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    if (error instanceof ClientVisibleError) {
      return clientVisibleErrorResponse(error, corsHeaders)
    }
    return safeErrorResponse(error, corsHeaders)
  }
})
