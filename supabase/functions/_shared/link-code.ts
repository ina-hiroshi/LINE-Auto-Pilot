/**
 * LIFF（予約ページ）と Messaging API（公式アカウントの Bot）の紐付けコード。
 *
 * LINE のユーザー ID はプロバイダーごとに別の値になる。LIFF が動く LINE ログイン
 * チャネルと店舗の Messaging API チャネルが別プロバイダーだと、同じお客様でも
 * 予約側の ID と Bot 側の ID が食い違う。
 *
 * そこで、予約が完了したら LIFF がお客様本人の発言として「確認コード」を
 * 公式アカウントのトークへ送る。Webhook がそれを受け取れば、Bot 側の ID
 * （event.source.userId）と予約側の ID をコードで結びつけられる。
 *
 * - liff.sendMessages で送ったテキストは Webhook に届く（Flex / テンプレートは届かない）
 * - お客様の発言への返信（応答メッセージ）は月間の配信数に数えられない
 */

export type LinkKind = 'created' | 'updated' | 'cancelled'

export const LINK_KINDS: readonly LinkKind[] = ['created', 'updated', 'cancelled']

/** 読み間違えやすい I / L / O / 0 / 1 を除いた 31 文字 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const LINK_CODE_LENGTH = 8

/** コードの有効期間。予約完了直後に送られる想定なので短くてよい。 */
export const LINK_CODE_TTL_MINUTES = 15

export function generateLinkCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LINK_CODE_LENGTH))
  let code = ''
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length]
  return code
}

const KIND_LABELS: Record<LinkKind, string> = {
  created: '予約しました',
  updated: '予約を変更しました',
  cancelled: '予約をキャンセルしました',
}

/**
 * お客様のトークにそのまま残る文面。
 * 見て意味が分かる文にしておく（コードだけだと何のメッセージか分からない）。
 */
export function buildLinkMessageText(kind: LinkKind, code: string): string {
  return `${KIND_LABELS[kind]}（確認コード ${code}）`
}

const LINK_CODE_PATTERN = /確認コード[\s:：]*([A-HJKMNP-Z2-9]{8})/

/** メッセージ本文から確認コードを取り出す。含まれていなければ null。 */
export function extractLinkCode(text: string | null | undefined): string | null {
  if (!text) return null
  const match = text.normalize('NFKC').toUpperCase().match(LINK_CODE_PATTERN)
  return match ? match[1] : null
}
