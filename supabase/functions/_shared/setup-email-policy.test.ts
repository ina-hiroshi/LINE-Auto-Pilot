import { assertEquals, assertThrows } from 'jsr:@std/assert@^1.0.0'
import { canOwnerSendSetupEmail, isSingleEmail, normalizeBasicId } from './setup-email-policy.ts'
import { escapeHtml } from './email-html.ts'

Deno.test('未払い・キャンセル・完了注文と完了メールは持ち主から送信できない', () => {
  const order = { status: 'paid', amount: 9980, paid_at: '2026-10-15T00:00:00Z' }
  for (const status of ['pending', 'cancelled', 'completed']) {
    assertEquals(canOwnerSendSetupEmail({ ...order, status }, 'payment_confirmation'), false)
  }
  assertEquals(canOwnerSendSetupEmail(order, 'completion'), false)
  for (const paid_at of [null, '', 'invalid']) {
    assertEquals(canOwnerSendSetupEmail({ ...order, paid_at }, 'payment_confirmation'), false)
  }
  assertEquals(canOwnerSendSetupEmail({ ...order, amount: -1 }, 'payment_confirmation'), false)
  assertEquals(canOwnerSendSetupEmail(order, 'payment_confirmation'), true)
  assertEquals(canOwnerSendSetupEmail({ ...order, status: 'in_progress', amount: 0 }, 'payment_confirmation'), true)
})

Deno.test('宛先は単一のメールアドレスのみ許可する', () => {
  assertEquals(isSingleEmail('owner+setup@example.com'), true)
  for (const value of ['a@example.com,b@example.com', 'Name <a@example.com>', 'a@example.com\r\nBcc:b@example.com', ['a@example.com'], null, 'a@']) {
    assertEquals(isSingleEmail(value), false)
  }
})

Deno.test('Basic ID の @ を正規化し、HTML・改行・長すぎる値を拒否する', () => {
  assertEquals(normalizeBasicId('@example._-1'), 'example._-1')
  assertEquals(normalizeBasicId(''), null)
  for (const value of ['<a href="https://evil.example">click</a>', 'abc\n', 'a'.repeat(51), '@@abc']) {
    assertThrows(() => normalizeBasicId(value))
  }
  assertEquals(escapeHtml(`<a title="x">&'</a>`), '&lt;a title=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;')
})
