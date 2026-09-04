import { generate as generateUuidV5 } from 'jsr:@std/uuid@^1.0.0/v5'

/**
 * LINE Messaging API の multicast（複数宛先への一斉送信）。
 *
 * push（1対1）は send-line-message が使っている。multicast は 1 リクエストで
 * 最大 500 宛先へ送れる代わりに、宛先ごとの成否を返さない。成否はリクエスト
 * 単位でしか分からないため、呼び出し側もバッチ単位で結果を記録する。
 */

export const MULTICAST_BATCH_SIZE = 500

const MULTICAST_URL = 'https://api.line.me/v2/bot/message/multicast'

/** このアプリのリトライキー生成用の名前空間（固定値。変更すると重複排除が効かなくなる） */
const RETRY_KEY_NAMESPACE = '9f2b4b3e-3d4a-4f6b-9c1e-6a7c5d8e0f12'

export type MulticastOutcome =
  | { ok: true; alreadyAccepted: boolean }
  | { ok: false; status: number; error: string; retriable: boolean }

export function chunkRecipients(ids: string[], size: number = MULTICAST_BATCH_SIZE): string[][] {
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += size) {
    batches.push(ids.slice(i, i + size))
  }
  return batches
}

/**
 * バッチごとに安定したリトライキーを作る。
 *
 * 同じ (キャンペーン, バッチ) には常に同じキーが出るので、送信は成功した
 * のにレスポンスを取りこぼした場合の再試行でも、LINE 側が重複と判定して
 * 二通目を配信しない。ランダム UUID だと再試行のたびに別リクエスト扱いに
 * なり、顧客に同じ内容が二度届く。
 */
export function buildRetryKey(campaignId: string, batchIndex: number): Promise<string> {
  const data = new TextEncoder().encode(`${campaignId}:${batchIndex}`)
  return generateUuidV5(RETRY_KEY_NAMESPACE, data)
}

/**
 * 1 バッチ（最大 500 宛先）を送信する。リトライは呼び出し側の責務。
 *
 * @param fetchImpl テストから差し替えるための注入口
 */
export async function postMulticast(
  token: string,
  to: string[],
  text: string,
  options: { retryKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<MulticastOutcome> {
  if (to.length === 0) {
    return { ok: false, status: 0, error: '宛先が空です', retriable: false }
  }
  if (to.length > MULTICAST_BATCH_SIZE) {
    return {
      ok: false,
      status: 0,
      error: `宛先が multicast の上限(${MULTICAST_BATCH_SIZE})を超えています`,
      retriable: false,
    }
  }

  const doFetch = options.fetchImpl ?? fetch
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
  if (options.retryKey) {
    headers['X-Line-Retry-Key'] = options.retryKey
  }

  let response: Response
  try {
    response = await doFetch(MULTICAST_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text }],
      }),
    })
  } catch (e) {
    // ネットワーク断は再試行の価値がある
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : String(e),
      retriable: true,
    }
  }

  if (response.ok) {
    return { ok: true, alreadyAccepted: false }
  }

  // 409 は「同じリトライキーのリクエストを既に受け付け済み」。
  // 送信は成立しているので成功として扱う。ここを失敗にすると、
  // 実際には届いているバッチを失敗として記録してしまう。
  if (response.status === 409) {
    return { ok: true, alreadyAccepted: true }
  }

  const body = await response.text().catch(() => '')
  return {
    ok: false,
    status: response.status,
    error: body.slice(0, 300),
    // 429（レート制限）と 5xx は時間を置けば通る見込みがある。
    // 400（宛先不正・本文不正）や 401/403（トークン不正）は再試行しても同じ。
    retriable: response.status === 429 || response.status >= 500,
  }
}
