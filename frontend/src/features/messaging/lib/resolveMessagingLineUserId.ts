import { supabase } from '../../../lib/supabase'

type CustomerLike = {
  line_user_id: string
  line_messaging_user_id?: string | null
  display_name: string | null
  real_name?: string | null
}

/**
 * LIFF の line_user_id と Messaging API の line_user_id が異なる場合に、
 * customer_logs から実際にメッセージのやり取りに使われている ID を解決する。
 */
export async function resolveMessagingLineUserIds(
  storeId: string,
  customer: CustomerLike,
): Promise<string[]> {
  // 紐付け済みの Bot 側の ID があれば最優先（予約時の確認コードで確定した ID）
  const ids = new Set<string>(
    [customer.line_messaging_user_id, customer.line_user_id].filter((id): id is string => Boolean(id)),
  )

  const namesToMatch = [
    customer.real_name?.trim(),
    customer.display_name?.trim(),
  ].filter((n): n is string => Boolean(n))

  for (const name of [...new Set(namesToMatch)]) {
    const { data: byName } = await supabase
      .from('customer_logs')
      .select('line_user_id')
      .eq('store_id', storeId)
      .eq('display_name', name)
      .order('created_at', { ascending: false })
      .limit(30)

    for (const row of byName ?? []) {
      if (row.line_user_id) ids.add(row.line_user_id)
    }
  }

  // 表示名が無い場合のみ、顧客 ID 直結のログを拾う
  if (ids.size === 1) {
    const { data: direct } = await supabase
      .from('customer_logs')
      .select('line_user_id')
      .eq('store_id', storeId)
      .eq('line_user_id', customer.line_user_id)
      .limit(5)
    for (const row of direct ?? []) {
      if (row.line_user_id) ids.add(row.line_user_id)
    }
  }

  return [...ids]
}

export async function resolveMessagingLineUserId(
  storeId: string,
  customer: CustomerLike,
): Promise<string> {
  if (customer.line_messaging_user_id) return customer.line_messaging_user_id

  const ids = await resolveMessagingLineUserIds(storeId, customer)
  if (ids.length === 1) return ids[0]
  // ログが複数 ID にまたがる場合は、customers 以外（Messaging 側）を優先
  const alternate = ids.find((id) => id !== customer.line_user_id)
  return alternate ?? customer.line_user_id
}
