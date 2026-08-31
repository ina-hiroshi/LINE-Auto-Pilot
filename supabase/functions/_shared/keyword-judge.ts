/**
 * キーワード定型文がユーザーの質問に足りるかの判定。
 *
 * 学習データは載せない。KEEP か AI の1語だけ返させ、思考トークンは切る。
 * 迷ったとき・パース不能・API失敗は AI（定型文の誤送信を避ける）。
 */

import { getGeminiUrl } from './ai-config.ts'

export type KeywordJudgeVerdict = 'keep' | 'ai'

/** 判定プロンプトに載せる定型文の上限。ここが判定コストをほぼ決める。 */
export const KEYWORD_JUDGE_MAX_RESPONSE_CHARS = 400

export const KEYWORD_JUDGE_MAX_OUTPUT_TOKENS = 8

export function buildKeywordJudgePrompt(
  keyword: string,
  responseText: string,
  userMessage: string,
): string {
  const clipped = responseText.length > KEYWORD_JUDGE_MAX_RESPONSE_CHARS
    ? `${responseText.slice(0, KEYWORD_JUDGE_MAX_RESPONSE_CHARS)}…`
    : responseText

  return `店舗LINEの応答振分。定型文が質問に過不足なく答えられるときだけ KEEP。
少しでも足りない、別用件、条件・例外、キャンセルや変更、日時の個別事情、定型文に書いてない内容なら AI。
言い換えになっていても、定型文の文言から答えが読み取れなければ AI。
迷ったら必ず AI。理由は書かず、KEEP か AI の1語だけ返す。

キーワード: ${keyword}
定型文: ${clipped}
ユーザー: ${userMessage}`
}

/**
 * モデル出力を KEEP / AI に正規化する。
 * 空白・句読点を除いた全体が KEEP のときだけ keep。説明や併記は ai。
 */
export function parseKeywordJudgeVerdict(raw: string | null | undefined): KeywordJudgeVerdict {
  if (!raw) return 'ai'
  const normalized = raw
    .trim()
    .replace(/[*`_#]/g, '')
    .replace(/[。．、,.：:\s]/g, '')
  if (/^KEEP$/i.test(normalized)) return 'keep'
  return 'ai'
}

function extractCandidateText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return ''
  const parts = (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts
    .map((part) => (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string' ? part.text : ''))
    .join('')
}

export async function judgeKeywordReplyFit(
  apiKey: string,
  input: { keyword: string; responseText: string; userMessage: string },
  fetchImpl: typeof fetch = fetch,
): Promise<KeywordJudgeVerdict> {
  const prompt = buildKeywordJudgePrompt(input.keyword, input.responseText, input.userMessage)

  try {
    const response = await fetchImpl(getGeminiUrl(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: KEYWORD_JUDGE_MAX_OUTPUT_TOKENS,
          temperature: 0,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })

    if (!response.ok) {
      console.error('Keyword judge API error:', response.status, await response.text())
      return 'ai'
    }

    const data: unknown = await response.json()
    return parseKeywordJudgeVerdict(extractCandidateText(data))
  } catch (error) {
    console.error('Keyword judge failed:', error)
    return 'ai'
  }
}
