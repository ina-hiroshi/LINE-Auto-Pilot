type CustomerLike = {
  line_user_id: string
  line_messaging_user_id?: string | null
  display_name: string | null
  real_name?: string | null
}

/** 履歴と送信先は顧客に紐付いた ID だけを使う。名前では結び付けない。 */
export async function resolveMessagingLineUserIds(
  _storeId: string,
  customer: CustomerLike,
): Promise<string[]> {
  return [...new Set(
    [customer.line_messaging_user_id, customer.line_user_id]
      .filter((id): id is string => Boolean(id)),
  )]
}

export async function resolveMessagingLineUserId(
  _storeId: string,
  customer: CustomerLike,
): Promise<string> {
  return customer.line_messaging_user_id || customer.line_user_id
}
