/**
 * Stripe Checkout（サブスクリプション）作成時の price_id 検証。
 *
 * create-checkout-session はブラウザから price_id をそのまま受け取り、
 * Stripe に渡してチェックアウトセッションを作っていた。認証さえ済んでいれば
 * Stripeアカウント内に存在する任意の price_id（無関係な安い商品・過去の
 * 廃止済みプラン等）を指定でき、そのサブスクリプションが active/trialing に
 * なった時点で Webhook 側は price_id を見ずに一律 plan='pro' を付与していた
 * ため、意図しない金額で Pro プランを取得できる状態だった。
 *
 * 正規の price_id をサーバー側の環境変数（STRIPE_PRICE_ID_PRO、
 * カンマ区切りで複数指定可）で管理し、それ以外は拒否する。
 */

/** カンマ区切りの環境変数値を、空白除去・空要素除去した price_id の配列にする */
export function parseAllowedPriceIds(raw: string | undefined | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

/** price_id が許可リストに含まれるか（文字列以外は常に拒否） */
export function isAllowedPriceId(priceId: unknown, allowed: string[]): boolean {
  return typeof priceId === 'string' && allowed.includes(priceId)
}
