import { ALLOWED_ORIGINS } from './cors.ts'

/** CORS のプレビュー・任意ポートの許可は、決済の戻り先には適用しない。 */
export function validateStripeReturnUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096 || /[\s\\]/.test(value)) {
    throw new Error('戻り先URLが不正です')
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('戻り先URLが不正です')
  }
  if (url.username || url.password || !ALLOWED_ORIGINS.includes(url.origin)) {
    throw new Error('戻り先URLは許可されていません')
  }
  return url.href
}

export function stripeSuccessUrl(returnUrl: string, key: 'session_id' | 'setup_order_id', value: string): string {
  const url = new URL(validateStripeReturnUrl(returnUrl))
  url.searchParams.set(key, value)
  // Stripe が置換するテンプレートは、波括弧をURLエンコードせず渡す。
  return url.href.replace('session_id=%7BCHECKOUT_SESSION_ID%7D', 'session_id={CHECKOUT_SESSION_ID}')
}
