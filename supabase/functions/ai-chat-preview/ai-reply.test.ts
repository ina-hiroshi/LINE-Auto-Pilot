import { assertEquals, assertRejects } from 'jsr:@std/assert@^1.0.0'
import { createFakeSupabase } from '../booking/handlers/testSupabase.ts'
import { generateAIResponse } from '../_shared/ai-reply.ts'
Deno.test('共通AI応答: プレビューのタグ除去とエラー応答を維持し公開側は失敗を検出できる', async () => {
  const original = globalThis.fetch
  const fake = createFakeSupabase(() => ({ data: [], error: null }))
  try {
    globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '回答 [MANUAL_REPLY_NEEDED]' }] } }] })))
    assertEquals(await generateAIResponse('test', 'hello', {}, 'store', fake.client), '回答')
    globalThis.fetch = () => Promise.resolve(new Response('{}', { status: 503 }))
    assertEquals(await generateAIResponse('test', 'hello', {}, 'store', fake.client), '申し訳ありません。現在AI応答を利用できません。')
    await assertRejects(() => generateAIResponse('test', 'hello', {}, 'store', fake.client, true))
  } finally { globalThis.fetch = original }
})
