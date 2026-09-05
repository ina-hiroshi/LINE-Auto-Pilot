import type { NormalizedMessage } from './social-dm-normalize.ts'

/**
 * insertedMessages（今回のポーリングで新規に取り込めた行）のうち、
 * 一番新しい inbound だけを自動応答の評価対象にする。
 *
 * ポーリングは5分ごとに全会話を再確認するため、そのままでは1回の
 * ポーリング周期に複数件の inbound が同時に自動応答をトリガーしてしまう
 * （5分の間に3通届けば3通返信しかねない）。「会話1件・周期1回につき
 * 最新の inbound 1件だけを見る」という形にすることで、追加のクールダウン
 * 判定を書かずにこれを構造的に防ぐ。
 */
export function pickNewestInbound(messages: NormalizedMessage[]): NormalizedMessage | null {
  const inbound = messages.filter((m) => m.direction === 'inbound')
  if (inbound.length === 0) return null
  return inbound.reduce((latest, m) => (m.occurredAt > latest.occurredAt ? m : latest), inbound[0])
}
