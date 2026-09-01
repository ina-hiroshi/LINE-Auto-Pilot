import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { decideVerification } from './verification-code-guard.ts'

const MAX = 5

Deno.test('該当コードが無ければ not_found', () => {
  assertEquals(decideVerification(null, '123456', MAX), { outcome: 'not_found' })
  assertEquals(decideVerification(undefined, '123456', MAX), { outcome: 'not_found' })
})

Deno.test('正しいコードなら success（対象コードのidを返す）', () => {
  const result = decideVerification({ id: 'row-1', code: '123456', attempts: 0 }, '123456', MAX)
  assertEquals(result, { outcome: 'success', id: 'row-1' })
})

Deno.test('間違ったコードなら wrong（試行回数を1増やして返す）', () => {
  const result = decideVerification({ id: 'row-1', code: '123456', attempts: 0 }, '000000', MAX)
  assertEquals(result, { outcome: 'wrong', nextAttempts: 1 })
})

Deno.test('試行回数が上限未満なら、正しいコードで success になる', () => {
  const result = decideVerification({ id: 'row-1', code: '123456', attempts: MAX - 1 }, '123456', MAX)
  assertEquals(result, { outcome: 'success', id: 'row-1' })
})

Deno.test('試行回数が上限に達していれば、正しいコードでも locked にする（総当たり対策の核心）', () => {
  const result = decideVerification({ id: 'row-1', code: '123456', attempts: MAX }, '123456', MAX)
  assertEquals(result, { outcome: 'locked' })
})

Deno.test('上限を超えていても locked', () => {
  const result = decideVerification({ id: 'row-1', code: '123456', attempts: MAX + 3 }, '123456', MAX)
  assertEquals(result, { outcome: 'locked' })
})

Deno.test('上限判定は誤答チェックより先に行う（lockedならDB更新を試みない）', () => {
  const result = decideVerification({ id: 'row-1', code: '123456', attempts: MAX }, 'wrong-guess', MAX)
  assertEquals(result, { outcome: 'locked' })
})

Deno.test('連続した誤答は毎回1ずつ増える', () => {
  let attempts = 0
  for (let i = 0; i < 3; i++) {
    const result = decideVerification({ id: 'row-1', code: '123456', attempts }, '999999', MAX)
    assertEquals(result, { outcome: 'wrong', nextAttempts: attempts + 1 })
    attempts = (result as { nextAttempts: number }).nextAttempts
  }
  assertEquals(attempts, 3)
})
