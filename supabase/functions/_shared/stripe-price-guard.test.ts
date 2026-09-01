import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { isAllowedPriceId, parseAllowedPriceIds } from './stripe-price-guard.ts'

const PRO = 'price_1SmKVC7JLpsQAtFkOSirIftK'
const OTHER = 'price_1SkA8F9gqo1AslYsV0rVvBzF'

Deno.test('parseAllowedPriceIds: 未設定なら空配列', () => {
  assertEquals(parseAllowedPriceIds(undefined), [])
  assertEquals(parseAllowedPriceIds(null), [])
  assertEquals(parseAllowedPriceIds(''), [])
})

Deno.test('parseAllowedPriceIds: 1件だけならそのまま', () => {
  assertEquals(parseAllowedPriceIds(PRO), [PRO])
})

Deno.test('parseAllowedPriceIds: カンマ区切りで複数プランを持てる（月額・年額など）', () => {
  assertEquals(parseAllowedPriceIds(`${PRO},${OTHER}`), [PRO, OTHER])
})

Deno.test('parseAllowedPriceIds: 前後の空白を落とす', () => {
  assertEquals(parseAllowedPriceIds(` ${PRO} , ${OTHER} `), [PRO, OTHER])
})

Deno.test('parseAllowedPriceIds: 空要素（連続カンマ・末尾カンマ）を落とす', () => {
  assertEquals(parseAllowedPriceIds(`${PRO},,${OTHER},`), [PRO, OTHER])
})

Deno.test('isAllowedPriceId: 許可リストに無い price_id は拒否する（無関係な安い商品での取得を防ぐ）', () => {
  assertEquals(isAllowedPriceId('price_totally_unrelated_cheap_item', [PRO]), false)
})

Deno.test('isAllowedPriceId: 許可リストにある price_id は通す', () => {
  assertEquals(isAllowedPriceId(PRO, [PRO, OTHER]), true)
})

Deno.test('isAllowedPriceId: 許可リストが空なら何であれ拒否する', () => {
  assertEquals(isAllowedPriceId(PRO, []), false)
})

Deno.test('isAllowedPriceId: 文字列以外（null/undefined/オブジェクト等）は拒否する', () => {
  assertEquals(isAllowedPriceId(null, [PRO]), false)
  assertEquals(isAllowedPriceId(undefined, [PRO]), false)
  assertEquals(isAllowedPriceId(123, [PRO]), false)
  assertEquals(isAllowedPriceId({ id: PRO }, [PRO]), false)
})

Deno.test('isAllowedPriceId: 空文字は拒否する', () => {
  assertEquals(isAllowedPriceId('', [PRO]), false)
})

Deno.test('isAllowedPriceId: 部分一致では通さない（前方一致等での回避を防ぐ）', () => {
  assertEquals(isAllowedPriceId(PRO.slice(0, -1), [PRO]), false)
  assertEquals(isAllowedPriceId(PRO + 'x', [PRO]), false)
})
