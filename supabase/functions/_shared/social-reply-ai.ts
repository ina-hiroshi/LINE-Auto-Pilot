import { getGeminiUrl } from './ai-config.ts'
import {
  buildSocialReplyPrompt,
  parseSocialReplyResult,
  type SocialReplyPromptInput,
  type SocialReplyResult,
} from './social-reply-prompt.ts'

/**
 * DM 返信文を Gemini で生成する（AI下書き・AI自動応答・プレビューの共通部分）。
 *
 * 失敗時は例外を投げる。social-dm-poll から呼ぶときは必ず try/catch で包み、
 * AI の失敗が DM 取り込みそのものを止めないようにすること。
 */
export async function generateSocialReply(
  apiKey: string,
  input: SocialReplyPromptInput,
  options: { timeoutMs?: number; temperature?: number } = {},
): Promise<SocialReplyResult> {
  const prompt = buildSocialReplyPrompt(input)

  const response = await fetch(getGeminiUrl(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 600, temperature: options.temperature ?? 0.4 },
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
  })

  if (!response.ok) {
    throw new Error(`Gemini API error: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`)
  }

  const data = await response.json()
  const aiText: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const result = parseSocialReplyResult(aiText)
  if (!result) throw new Error(`AI 応答を解釈できませんでした: ${aiText.slice(0, 200)}`)
  return result
}
