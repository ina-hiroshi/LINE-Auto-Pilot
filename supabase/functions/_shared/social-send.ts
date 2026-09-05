/**
 * IG/FB への DM 送信（Send API）。
 *
 * エンドポイントは IG が `POST graph.instagram.com/v21.0/me/messages`、
 * FB が `POST graph.facebook.com/v21.0/<PAGE_ID>/messages`。
 *
 * 24h ウィンドウ内は `messaging_type: 'RESPONSE'`、24h〜7d の
 * HUMAN_AGENT 送信は `messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT'`
 * を付ける。どちらを付けるかは呼び出し側が
 * `_shared/meta-messaging-window.ts` の判定結果からそのまま渡す
 * （このモジュール自身はウィンドウ判定を一切行わない＝送信の是非は
 * 呼び出し側の責務のまま保つ）。
 */

const IG_BASE = 'https://graph.instagram.com/v21.0'
const FB_BASE = 'https://graph.facebook.com/v21.0'

export type SendTarget = {
  platform: 'instagram' | 'facebook'
  accountRef: string
  recipientId: string
  token: string
}

export type SendResult =
  | { ok: true; recipientId: string; messageId: string | null }
  | { ok: false; status: number; error: unknown }

export async function sendDirectMessage(
  target: SendTarget,
  text: string,
  tag: 'HUMAN_AGENT' | null,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const url =
    target.platform === 'instagram'
      ? `${IG_BASE}/me/messages`
      : `${FB_BASE}/${target.accountRef}/messages`

  const body: Record<string, unknown> = {
    recipient: { id: target.recipientId },
    message: { text },
    messaging_type: tag ? 'MESSAGE_TAG' : 'RESPONSE',
  }
  if (tag) body.tag = tag

  const res = await fetchImpl(`${url}?access_token=${encodeURIComponent(target.token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const payload: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, status: res.status, error: payload }
  }

  const recipientId = (payload as { recipient_id?: string } | null)?.recipient_id ?? target.recipientId
  const messageId = (payload as { message_id?: string } | null)?.message_id ?? null
  return { ok: true, recipientId, messageId }
}
