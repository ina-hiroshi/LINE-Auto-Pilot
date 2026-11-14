import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { extractEcCustomerCode } from './ec-customer-code.ts'

Deno.test('ショップ連携コード: NFKC と大文字にそろえる', () => {
  assertEquals(extractEcCustomerCode('ショップ連携コード ａｂｃｄ２３４５'), 'ABCD2345')
  assertEquals(extractEcCustomerCode('ショップ連携コード：abcdefgh'), 'ABCDEFGH')
})

Deno.test('ショップ連携コード: 予約コード・禁止文字・長さ違いは取り出さない', () => {
  for (const text of [null, undefined, '', '確認コード ABCD2345', 'ショップ連携コード ABCI2345',
    'ショップ連携コード ABCD234', 'ショップ連携コード ABCD23456', 'ショップ連携コード ABCO2345']) {
    assertEquals(extractEcCustomerCode(text), null)
  }
})
