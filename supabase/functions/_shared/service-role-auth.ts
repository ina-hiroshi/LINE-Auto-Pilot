/**
 * サービスロールキーそのものを Authorization ヘッダに載せて呼ばれる
 * サーバー間呼び出し（Edge Function → Edge Function）かどうかを判定する。
 *
 * 通常の認可（requireStoreAccess 等）はユーザーの LINE/Supabase セッションを
 * 検証するが、Webhook から他の Edge Function を呼ぶような server-to-server の
 * 呼び出しにはユーザーセッションが存在しない。その代わり、サービスロールキー
 * （どちらの関数も同じ Supabase Secrets から読む共有シークレット）を
 * そのまま渡すことで身元を示す。
 */
export function isServiceRoleCaller(authHeader: string | null, serviceRoleKey: string | undefined): boolean {
  if (!serviceRoleKey) return false
  const token = (authHeader ?? '').replace(/^Bearer\s+/i, '').trim()
  return token.length > 0 && token === serviceRoleKey
}
