import { assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert@^1.0.0'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ClientVisibleError } from './error-utils.ts'
import { boundedText, validatePreviewInput, requirePaidAiPlan, reserveAiGeneration } from './ai-generation-policy.ts'

Deno.test('プレビューは許可した設定だけを使う', () => {
  assertEquals(validatePreviewInput('  hello ', { tone: 'polite', persona_prompt: ' role ', system_prompt: 'ignore' }), {
    message: 'hello', settings: { tone: 'polite', persona_prompt: 'role' },
  })
})
Deno.test('不正な設定と長すぎる入力は拒否する', () => {
  for (const settings of [null, [], 'text', {}, { tone: 'unknown' }, { tone: 'polite', persona_prompt: 12 }, { tone: 'polite', persona_prompt: 'x'.repeat(4001) }]) {
    assertThrows(() => validatePreviewInput('hello', settings), ClientVisibleError)
  }
  for (const message of ['', '   ', 42, 'x'.repeat(4001)]) {
    assertThrows(() => validatePreviewInput(message, { tone: 'friendly' }), ClientVisibleError)
  }
  assertThrows(() => boundedText('x'.repeat(1001), 1000, 'detail'), ClientVisibleError)
})
function planClient(plan: string | null, profileError = false) {
  const ids: unknown[] = []
  const admin = { from(table: string) {
    return { select() { return this }, eq(_key: string, value: unknown) { ids.push(value); return this },
      single() { return Promise.resolve(table === 'stores'
        ? { data: { owner_id: 'owner' }, error: null }
        : { data: { plan }, error: profileError ? { message: 'db error' } : null }) },
    }
  } } as unknown as SupabaseClient
  return { admin, ids }
}
Deno.test('無料・不明のプランは拒否し、有料プランのみ許可する', async () => {
  for (const plan of ['free', 'trial', null]) {
    const { admin } = planClient(plan)
    const error = await assertRejects(() => requirePaidAiPlan(admin, 'store'), ClientVisibleError)
    assertEquals(error.statusCode, 403)
  }
  for (const plan of ['pro', 'executive']) {
    const { admin, ids } = planClient(plan)
    await requirePaidAiPlan(admin, 'store')
    assertEquals(ids, ['store', 'owner'])
  }
})
Deno.test('プラン確認のDB障害では生成を許可しない', async () => {
  const error = await assertRejects(() => requirePaidAiPlan(planClient('pro', true).admin, 'store'), ClientVisibleError)
  assertEquals(error.statusCode, 503)
})
Deno.test('枠の予約はアトミックなRPCで行う', async () => {
  const calls: unknown[] = []
  const admin = { rpc(name: string, params: unknown) { calls.push([name, params]); return Promise.resolve({ data: true, error: null }) } } as unknown as SupabaseClient
  await reserveAiGeneration(admin, 'store', 'ai-chat-preview')
  assertEquals(calls, [['reserve_ai_generation', { p_store_id: 'store', p_feature: 'ai-chat-preview' }]])
})
Deno.test('上限超過・RPC障害・不正な応答では生成を許可しない', async () => {
  for (const [data, error, status] of [[false, null, 429], [null, { message: 'db error' }, 503], [null, null, 503]] as const) {
    const admin = { rpc: () => Promise.resolve({ data, error }) } as unknown as SupabaseClient
    const failure = await assertRejects(() => reserveAiGeneration(admin, 'store', 'campaign-generator'), ClientVisibleError)
    assertEquals(failure.statusCode, status)
  }
})
