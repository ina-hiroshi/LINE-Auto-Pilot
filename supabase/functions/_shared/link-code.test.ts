import { assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert@1'
import {
  buildLinkMessageText,
  extractLinkCode,
  generateLinkCode,
  LINK_CODE_LENGTH,
} from './link-code.ts'

Deno.test('generateLinkCode: 8 文字で、紛らわしい文字を含まない', () => {
  for (let i = 0; i < 200; i++) {
    const code = generateLinkCode()
    assertEquals(code.length, LINK_CODE_LENGTH)
    assertMatch(code, /^[A-HJKMNP-Z2-9]{8}$/)
  }
})

Deno.test('generateLinkCode: 続けて作っても重ならない', () => {
  const codes = new Set(Array.from({ length: 500 }, () => generateLinkCode()))
  assertEquals(codes.size, 500)
})

Deno.test('buildLinkMessageText → extractLinkCode で往復できる', () => {
  for (const kind of ['created', 'updated', 'cancelled'] as const) {
    const text = buildLinkMessageText(kind, 'ABCD2345')
    assertEquals(extractLinkCode(text), 'ABCD2345')
  }
})

Deno.test('buildLinkMessageText: 何の通知か分かる文面になる', () => {
  assertEquals(buildLinkMessageText('created', 'ABCD2345'), '予約しました（確認コード ABCD2345）')
  assertEquals(buildLinkMessageText('updated', 'ABCD2345'), '予約を変更しました（確認コード ABCD2345）')
  assertEquals(
    buildLinkMessageText('cancelled', 'ABCD2345'),
    '予約をキャンセルしました（確認コード ABCD2345）',
  )
})

Deno.test('extractLinkCode: 全角・小文字・区切りの違いを吸収する', () => {
  assertEquals(extractLinkCode('確認コード：ＡＢＣＤ２３４５'), 'ABCD2345')
  assertEquals(extractLinkCode('確認コード abcd2345'), 'ABCD2345')
  assertEquals(extractLinkCode('確認コードABCD2345'), 'ABCD2345')
})

Deno.test('extractLinkCode: 通常のメッセージや不正なコードは null', () => {
  assertEquals(extractLinkCode('営業時間を教えてください'), null)
  assertEquals(extractLinkCode('確認コード ABC'), null)
  // 紛らわしい文字（I / L / O / 0 / 1）は使わない
  assertEquals(extractLinkCode('確認コード ABCDEFG1'), null)
  assertEquals(extractLinkCode('確認コード ABCDEFGO'), null)
  assertEquals(extractLinkCode(''), null)
  assertEquals(extractLinkCode(null), null)
  assertEquals(extractLinkCode(undefined), null)
  assertNotEquals(extractLinkCode('予約したい ABCD2345'), 'ABCD2345')
})
