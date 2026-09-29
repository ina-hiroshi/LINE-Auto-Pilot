import type { SupabaseClientType } from './types.ts'

/**
 * 一斉配信の宛先の解決。
 *
 * get_segment_customers が返す line_user_id は「予約ページ（LIFF）側」のユーザー ID。
 * LIFF の LINE ログインチャネルと店舗の Messaging API チャネルが別プロバイダーだと、
 * 同じお客様でも Bot 側の ID は別の値になり、LIFF 側の ID を宛先にしても届かない
 * （LINE は受け付けたと返すので、送信済みと表示されてしまう）。
 *
 * そのため、配信の宛先は次のとおりに決める。
 * 1. 予約時の確認コードで紐付いた Bot 側の ID（customers.line_messaging_user_id）
 * 2. 紐付けが無い場合は、店舗が「同じ体系」（stores.line_ids_aligned = true）のときだけ LIFF 側の ID
 * 3. どちらでもなければ配信できない（数えて画面に伝える）
 */

export type SegmentRow = {
  customer_id: string
  line_user_id: string
  display_name: string | null
}

export type ResolvedRecipient = {
  customer_id: string
  /** 実際に配信する宛先（Bot 側の ID、または同じ体系の店舗の LIFF 側 ID） */
  line_user_id: string
  display_name: string | null
}

export type ResolvedRecipients = {
  deliverable: ResolvedRecipient[]
  /** 宛先を決められず、配信できないお客様の数 */
  undeliverable: number
}

export function resolveRecipients(
  rows: SegmentRow[],
  messagingIds: ReadonlyMap<string, string>,
  aligned: boolean | null,
): ResolvedRecipients {
  const deliverable: ResolvedRecipient[] = []
  const seen = new Set<string>()
  let undeliverable = 0

  for (const row of rows) {
    const destination = messagingIds.get(row.customer_id) ?? (aligned === true ? row.line_user_id : null)
    if (!destination) {
      undeliverable++
      continue
    }
    // 同じ宛先に二度送らない
    if (seen.has(destination)) continue
    seen.add(destination)
    deliverable.push({ customer_id: row.customer_id, line_user_id: destination, display_name: row.display_name })
  }

  return { deliverable, undeliverable }
}

const PAGE_SIZE = 1000

export type RecipientContext = {
  /** customer_id → Bot 側の ID（紐付け済みの顧客だけ） */
  messagingIds: Map<string, string>
  aligned: boolean | null
}

/** 店舗の紐付け状況を読み込む。 */
export async function loadRecipientContext(
  admin: SupabaseClientType,
  storeId: string,
): Promise<RecipientContext> {
  const messagingIds = new Map<string, string>()

  // PostgREST は 1 回で 1000 行までしか返さないので、ページ送りする
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from('customers')
      .select('id, line_messaging_user_id')
      .eq('store_id', storeId)
      .not('line_messaging_user_id', 'is', null)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`customers lookup failed: ${error.message}`)
    for (const row of data ?? []) {
      if (row.line_messaging_user_id) messagingIds.set(row.id, row.line_messaging_user_id)
    }
    if (!data || data.length < PAGE_SIZE) break
  }

  const { data: store, error: storeError } = await admin
    .from('stores')
    .select('line_ids_aligned')
    .eq('id', storeId)
    .maybeSingle()
  if (storeError) throw new Error(`stores lookup failed: ${storeError.message}`)

  return { messagingIds, aligned: store?.line_ids_aligned ?? null }
}

/**
 * 友だち数の目安。LINE の統計（line_friend_stats、1 日 1 回同期）の最新値。
 * 友だちが少ない、または統計が未集計のときは取れないので null。
 */
export async function loadFriendCount(admin: SupabaseClientType, storeId: string): Promise<number | null> {
  const { data } = await admin
    .from('line_friend_stats')
    .select('followers')
    .eq('store_id', storeId)
    .not('followers', 'is', null)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return typeof data?.followers === 'number' ? data.followers : null
}
