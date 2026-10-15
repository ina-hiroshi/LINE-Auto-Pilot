/** 送信先は顧客に紐付いた ID だけから決める。名前は本人確認に使わない。 */

export type CustomerForRecipient = {
  line_user_id?: string | null
  /** 予約時に紐付いた Bot 側の ID。あればこれが一番確実に届く */
  line_messaging_user_id?: string | null
  display_name?: string | null
  real_name?: string | null
}

/** ログに表示する名前（本名優先）。空文字や空白のみは使わない。 */
export function resolveLogLabel(
  customer: CustomerForRecipient | null | undefined,
  fallbackDisplayName?: string | null,
): string | null {
  return (
    customer?.real_name?.trim() ||
    customer?.display_name?.trim() ||
    fallbackDisplayName?.trim() ||
    null
  )
}

export type BuildRecipientCandidatesInput = {
  /** 画面から渡された送信先 */
  requestedUserId: string
  /** 顧客レコード（customerId 指定時のみ） */
  customer?: CustomerForRecipient | null
}

/**
 * 送信先候補を優先順に並べて返す。
 * 1. 顧客に紐付いた Bot 側の ID（予約時の確認コードで紐付いたもの）
 * 2. 画面が指定した ID
 * 3. 顧客レコードの ID（予約側）
 */
export function buildRecipientCandidates({
  requestedUserId,
  customer,
}: BuildRecipientCandidatesInput): string[] {
  const candidates: string[] = []
  const add = (id: string | null | undefined) => {
    const value = id?.trim()
    if (!value || candidates.includes(value)) return
    candidates.push(value)
  }

  add(customer?.line_messaging_user_id)
  add(requestedUserId)
  add(customer?.line_user_id)

  return candidates
}
