import { assertEquals, assertMatch } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { generateVerificationCode } from './verification-code.ts'
Deno.test('認証コードの範囲の両端', () => {
  assertEquals(generateVerificationCode(() => 0), '100000')
  assertEquals(generateVerificationCode(() => 899999), '999999')
})
Deno.test('偏りが出る範囲の乱数は棄却する', () => {
  const values = [4294967295, 4294800000, 900000]
  assertEquals(generateVerificationCode(() => values.shift()!), '100000')
  assertEquals(values.length, 0)
})
Deno.test('暗号論的乱数でも常に6桁', () => {
  for (let i = 0; i < 1000; i++) assertMatch(generateVerificationCode(), /^[1-9][0-9]{5}$/)
})
