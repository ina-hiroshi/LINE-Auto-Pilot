import { assertEquals, assertThrows } from 'jsr:@std/assert@^1.0.0'
import { validateStripeReturnUrl, stripeSuccessUrl } from './stripe-return-url.ts'

Deno.test('本番・固定ドメインと既知の開発オリジンを許可', () => {
  for (const origin of ['https://itoguchi-app.jp', 'https://itoguchi.vercel.app', 'https://line-auto-pilot.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173']) {
    assertEquals(validateStripeReturnUrl(`${origin}/onboarding?x=1#plan`), `${origin}/onboarding?x=1#plan`)
  }
})
Deno.test('外部サイト・プレビュー・認証情報・紛らわしいURLを拒否', () => {
  for (const value of [null, {}, '', '/onboarding', '//itoguchi-app.jp', 'javascript:alert(1)', 'data:text/html,test', 'http://itoguchi-app.jp', 'https://itoguchi-app.jp.evil.example', 'https://evil.vercel.app', 'https://preview-itoguchi.vercel.app', 'https://itoguchi-app.jp@evil.example', 'https://evil@itoguchi-app.jp', 'https://itoguchi-app.jp:444', 'http://localhost:9999', 'https://itoguchi-app.jp\\@evil.example', 'https://itoguchi-app.jp/\nfoo', ' https://itoguchi-app.jp']) {
    assertThrows(() => validateStripeReturnUrl(value))
  }
})
Deno.test('既存クエリとフラグメントを保ち、結果パラメーターを上書きする', () => {
  assertEquals(stripeSuccessUrl('https://itoguchi-app.jp/onboarding?x=1&session_id=old#plan', 'session_id', '{CHECKOUT_SESSION_ID}'), 'https://itoguchi-app.jp/onboarding?x=1&session_id={CHECKOUT_SESSION_ID}#plan')
  assertEquals(stripeSuccessUrl('https://itoguchi-app.jp/onboarding#plan', 'setup_order_id', 'order-123'), 'https://itoguchi-app.jp/onboarding?setup_order_id=order-123#plan')
  assertThrows(() => stripeSuccessUrl('https://evil.example', 'session_id', 'test'))
})
