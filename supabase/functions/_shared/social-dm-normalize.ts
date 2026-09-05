/**
 * Instagram/Facebook の DM ポーリング結果を正規化する純粋関数群。
 *
 * ここでのフィールド名（participants, updated_time,
 * messages{id,from,to,message,created_time,attachments}）は実際に
 * graph.instagram.com/v21.0/me/conversations へ投げて確認済み
 * （エラーにならず {"data":[]} が返った）。ただし実データはまだ1件も
 * 無いため、attachments・story reply・reaction の実ペイロード形は未確認。
 * 判別できないものは種別を 'other' に落とすだけで、raw を必ず残す
 * （ad-name-parser と同じ「捨てずにバケットへ」方針）。
 */

export type GraphParticipant = {
  id?: string
  username?: string
  name?: string
}

export type GraphAttachment = {
  type?: string
}

export type GraphMessage = {
  id?: string
  from?: { id?: string }
  message?: string
  created_time?: string
  attachments?: { data?: GraphAttachment[] }
}

export type GraphConversation = {
  id?: string
  updated_time?: string
  participants?: { data?: GraphParticipant[] }
  messages?: { data?: GraphMessage[] }
}

export type NormalizedMessage = {
  externalMessageId: string
  dedupeKey: string
  direction: 'inbound' | 'outbound'
  messageType: 'text' | 'image' | 'other'
  text: string | null
  attachments: GraphAttachment[] | null
  occurredAt: string
  raw: GraphMessage
}

/** 自社アカウント以外の参加者を返す。1:1 DM のみを想定（グループは対象外）。 */
export function extractOtherParticipant(
  conv: GraphConversation,
  accountRef: string,
): GraphParticipant | null {
  const participants = conv.participants?.data ?? []
  return participants.find((p) => p.id && p.id !== accountRef) ?? null
}

/**
 * 1メッセージを正規化する。id と created_time が無いものは取り込めない
 * （会話の同一性・時系列のどちらも保証できないため）。
 *
 * dedupeKey は今は mid そのもの。webhook 導入後、リアクション等が親メッセージの
 * mid を再引用してくる場合はイベント種別を合成した別の dedupeKey に切り替える
 * 必要があるが、テーブル側の列はその変更を吸収できる形にしてある。
 */
export function classifyMessage(raw: GraphMessage, accountRef: string): NormalizedMessage | null {
  if (!raw.id || !raw.created_time) return null

  const direction: 'inbound' | 'outbound' = raw.from?.id === accountRef ? 'outbound' : 'inbound'
  const attachments = raw.attachments?.data ?? []

  let messageType: NormalizedMessage['messageType'] = 'other'
  if (attachments.length > 0) {
    messageType = attachments[0]?.type === 'image' ? 'image' : 'other'
  } else if (raw.message) {
    messageType = 'text'
  }

  return {
    externalMessageId: raw.id,
    dedupeKey: raw.id,
    direction,
    messageType,
    text: raw.message ?? null,
    attachments: attachments.length > 0 ? attachments : null,
    occurredAt: raw.created_time,
    raw,
  }
}

/** 会話に含まれるメッセージ群から正規化済みメッセージの配列を作る。壊れた行は静かに捨てる。 */
export function classifyMessages(conv: GraphConversation, accountRef: string): NormalizedMessage[] {
  return (conv.messages?.data ?? [])
    .map((m) => classifyMessage(m, accountRef))
    .filter((m): m is NormalizedMessage => m !== null)
}

/**
 * last_inbound_at はメッセージングウィンドウ判定の唯一の情報源であり、
 * 受信メッセージだけが更新してよい。送信・echo からは絶対に呼ばない。
 */
export function latestInboundOccurredAt(messages: NormalizedMessage[]): string | null {
  const inbound = messages.filter((m) => m.direction === 'inbound')
  if (inbound.length === 0) return null
  return inbound.reduce((latest, m) => (m.occurredAt > latest ? m.occurredAt : latest), inbound[0].occurredAt)
}

export function latestOccurredAt(messages: NormalizedMessage[]): string | null {
  if (messages.length === 0) return null
  return messages.reduce((latest, m) => (m.occurredAt > latest ? m.occurredAt : latest), messages[0].occurredAt)
}
