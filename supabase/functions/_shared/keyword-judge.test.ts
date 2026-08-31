import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import {
  buildKeywordJudgePrompt,
  judgeKeywordReplyFit,
  KEYWORD_JUDGE_MAX_RESPONSE_CHARS,
  parseKeywordJudgeVerdict,
} from './keyword-judge.ts'

Deno.test('parseKeywordJudgeVerdict: KEEP だけ keep、他はすべて ai', () => {
  assertEquals(parseKeywordJudgeVerdict('KEEP'), 'keep')
  assertEquals(parseKeywordJudgeVerdict('keep'), 'keep')
  assertEquals(parseKeywordJudgeVerdict('  KEEP。'), 'keep')
})

Deno.test('parseKeywordJudgeVerdict: 迷う出力・説明付きは ai（定型文の誤送信を避ける）', () => {
  assertEquals(parseKeywordJudgeVerdict('AI'), 'ai')
  assertEquals(parseKeywordJudgeVerdict('ai'), 'ai')
  assertEquals(parseKeywordJudgeVerdict('KEEPかも'), 'ai')
  assertEquals(parseKeywordJudgeVerdict('たぶんKEEP'), 'ai')
  assertEquals(parseKeywordJudgeVerdict('KEEP\n十分です'), 'ai')
  assertEquals(parseKeywordJudgeVerdict('KEEP、ただしキャンセルは不可'), 'ai')
  assertEquals(parseKeywordJudgeVerdict('KEEP AI'), 'ai')
  assertEquals(parseKeywordJudgeVerdict('定型文で足りる'), 'ai')
  assertEquals(parseKeywordJudgeVerdict(''), 'ai')
  assertEquals(parseKeywordJudgeVerdict(null), 'ai')
})

Deno.test('buildKeywordJudgePrompt: 定型文が長いとき切り詰める', () => {
  const long = 'あ'.repeat(KEYWORD_JUDGE_MAX_RESPONSE_CHARS + 50)
  const prompt = buildKeywordJudgePrompt('料金', long, 'カットの料金は？')
  assertEquals(prompt.includes(`${'あ'.repeat(KEYWORD_JUDGE_MAX_RESPONSE_CHARS)}…`), true)
  assertEquals(prompt.includes('迷ったら必ず AI'), true)
})

Deno.test('judgeKeywordReplyFit: KEEP なら keep', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'KEEP' }] } }],
    }))
  const verdict = await judgeKeywordReplyFit('key', {
    keyword: '営業時間',
    responseText: '10:00〜19:00です',
    userMessage: 'お店の営業時間を知りたいのですが夜もやってますか',
  }, fetchImpl)
  assertEquals(verdict, 'keep')
})

Deno.test('judgeKeywordReplyFit: API失敗・空応答は ai', async () => {
  const fail: typeof fetch = async () => new Response('nope', { status: 500 })
  const empty: typeof fetch = async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [] } }] }))
  const boom: typeof fetch = async () => {
    throw new Error('network')
  }

  const input = { keyword: '予約', responseText: 'メニューから', userMessage: 'キャンセルしたい' }
  assertEquals(await judgeKeywordReplyFit('key', input, fail), 'ai')
  assertEquals(await judgeKeywordReplyFit('key', input, empty), 'ai')
  assertEquals(await judgeKeywordReplyFit('key', input, boom), 'ai')
})
