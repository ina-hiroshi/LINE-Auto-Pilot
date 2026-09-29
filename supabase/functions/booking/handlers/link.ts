import type { SupabaseClientType } from '../../_shared/types.ts'
import {
  buildLinkMessageText,
  generateLinkCode,
  LINK_CODE_TTL_MINUTES,
  type LinkKind,
} from '../../_shared/link-code.ts'

/**
 * 予約の完了・変更・キャンセル後に、LIFF がお客様のトークへ送る確認メッセージを作る。
 *
 * Webhook がそのメッセージからコードを読み取り、Bot 側のユーザー ID と予約側の
 * ユーザー ID を結びつけたうえで、予約内容の Flex Message を返信する。
 *
 * 紐付けは付加機能なので、ここで失敗しても予約自体は成功させる（null を返す）。
 * 店舗の手動登録（管理者操作）はお客様のトークが無いので対象外。
 */
export async function issueLinkMessage(
  supabaseClient: SupabaseClientType,
  params: {
    store_id: string
    line_user_id?: string | null
    reservation_id: string
    kind: LinkKind
    isManualRegistration: boolean
  },
): Promise<string | null> {
  const { store_id, line_user_id, reservation_id, kind, isManualRegistration } = params
  if (isManualRegistration || !line_user_id) return null

  try {
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60 * 1000).toISOString()

    // コードの衝突（unique 違反）はごくまれだが、その場合だけ作り直す
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateLinkCode()
      const { error } = await supabaseClient.from('line_messaging_link_tokens').insert({
        store_id,
        login_line_user_id: line_user_id,
        code,
        kind,
        reservation_id,
        expires_at: expiresAt,
      })
      if (!error) return buildLinkMessageText(kind, code)
      if (error.code !== '23505') {
        console.error('issueLinkMessage insert failed:', error.message)
        return null
      }
    }
  } catch (e) {
    console.error('issueLinkMessage failed:', e)
  }
  return null
}
