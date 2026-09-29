import liff from '@line/liff'

/**
 * 予約の完了・変更・キャンセル後に、確認メッセージをお客様本人の発言として
 * 公式アカウントのトークへ送る。
 *
 * Webhook がこのメッセージ（「確認コード」入り）を受け取ると、Bot 側の LINE ユーザー ID と
 * 予約側の ID を紐付け、予約内容のリッチメッセージを返信する。
 *
 * 送れない条件（どれでも予約自体は成功しているので、黙ってやめる）:
 * - LINE アプリ内のブラウザで開いていない
 * - 1 対 1 のトークから開いていない（グループへ誤って投稿しない）
 * - LIFF アプリで chat_message.write スコープが有効でない / お客様が許可しなかった
 *
 * @returns 送信した場合 true
 */
export async function sendLinkMessage(message: unknown): Promise<boolean> {
  if (typeof message !== 'string' || message.length === 0) return false

  try {
    if (!liff.isInClient()) return false
    // グループ・複数人トークには送らない
    if (liff.getContext()?.type !== 'utou') return false

    const permission = await liff.permission.query('chat_message.write')
    if (permission.state === 'unavailable') return false

    await liff.sendMessages([{ type: 'text', text: message }])
    return true
  } catch (e) {
    // 許可の拒否（403）や、トークから開いていない場合など。予約の完了には影響させない。
    console.warn('sendLinkMessage skipped:', e instanceof Error ? e.message : e)
    return false
  }
}
