/**
 * LINE への送信先候補の組み立て。
 *
 * LIFF で得られる userId と Messaging API 側の userId は食い違うことがあるため、
 * 顧客レコードや過去ログから代替の ID を集めて順に試す。
 * ただし LINE の表示名も本名も一意ではないので、同名の顧客が他にいる場合は
 * 名前一致で拾った ID を候補に入れてはいけない。入れてしまうと、
 * 本来の ID への送信が失敗したときに別人へメッセージが届く。
 */

export type CustomerForRecipient = {
  line_user_id?: string | null
  display_name?: string | null
  real_name?: string | null
}

export type NameLogRow = { line_user_id?: string | null }

/** ログ照会に使う名前（本名優先）。空文字や空白のみは使わない。 */
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
  /** 同名で引いた customer_logs の行 */
  logsByName?: NameLogRow[] | null
  /** 同じ店舗で同名の顧客が他にもいるか */
  nameIsAmbiguous?: boolean
}

/**
 * 送信先候補を優先順に並べて返す。
 * 1. 画面が指定した ID
 * 2. 顧客レコードの ID
 * 3. 名前一致のログから拾った ID（同名が他にいなければ）
 */
export function buildRecipientCandidates({
  requestedUserId,
  customer,
  logsByName,
  nameIsAmbiguous = false,
}: BuildRecipientCandidatesInput): string[] {
  const candidates: string[] = []
  const add = (id: string | null | undefined) => {
    const value = id?.trim()
    if (!value || candidates.includes(value)) return
    candidates.push(value)
  }

  add(requestedUserId)
  add(customer?.line_user_id)

  if (!nameIsAmbiguous) {
    for (const row of logsByName ?? []) add(row.line_user_id)
  }

  return candidates
}
