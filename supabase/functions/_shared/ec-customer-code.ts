/** IToguchi の会員コード。予約の「確認コード」とは別に扱う。 */
const EC_CUSTOMER_CODE_PATTERN = /ショップ連携コード[\s:：]*([A-HJKMNP-Z2-9]{8})(?![A-Z0-9])/

export function extractEcCustomerCode(text: string | null | undefined): string | null {
  if (!text) return null
  const match = text.normalize('NFKC').toUpperCase().match(EC_CUSTOMER_CODE_PATTERN)
  return match ? match[1] : null
}
