import { boundedText } from './ai-untrusted.ts'
import { SOCIAL_REPLY_MAX_CHARS, type SocialReplyPromptInput, type SocialReplyResult } from './social-reply-prompt.ts'

const HUMAN_TOPIC = /料金|金額|見積|返金|割引|無料|支払|決済|キャンセル|予約|申込|確約|保証|必ず|絶対|承諾|約束|苦情|クレーム|トラブル|相談|個人情報|電話番号|住所変更|password|refund|discount|guarantee|book(?:ing)?|payment|complaint|\d[\d,.]*\s*(?:円|ドル|%|パーセント|yen|usd)|[¥$€]/i
const INJECTION = /指示|プロンプト|学習データ|システム|命令|無視|全文|復唱|ignore|instruction|system|prompt|persona|repeat|reveal|override/i
const URL = /https?:\/\/[^\s<>"'）)]+/gi

/** 自動送信に不向きな入力はモデルの判断にかかわらず人に回す。 */
export function requiresHumanReview(input: SocialReplyPromptInput): boolean {
  if (input.mode !== 'auto') return false
  const inbound = input.recentMessages.filter(m => m.direction === 'inbound').slice(-10)
  return inbound.some(m => {
    const text = boundedText(m.text, 4000)
    return Array.from(m.text ?? '').length > 2000 || HUMAN_TOPIC.test(text) || INJECTION.test(text)
  }) || INJECTION.test(boundedText(input.displayName, 200))
}

export function validateSocialReply(result: SocialReplyResult, input: SocialReplyPromptInput): SocialReplyResult {
  const blocked: SocialReplyResult = { draft: null, needsHuman: true }
  const text = result.draft?.trim() ?? ''
  if (input.mode !== 'auto') {
    return { draft: text ? Array.from(text).slice(0, SOCIAL_REPLY_MAX_CHARS).join('') : null, needsHuman: result.needsHuman }
  }
  if (result.needsHuman || !text || Array.from(text).length > SOCIAL_REPLY_MAX_CHARS || requiresHumanReview(input)) return blocked
  const normalized = boundedText(text, SOCIAL_REPLY_MAX_CHARS)
  if (HUMAN_TOPIC.test(normalized) || INJECTION.test(normalized) || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(text)) return blocked
  const knowledge = boundedText(input.knowledgeText, 20000)
  if (/(?:javascript|data|file|ftp):|www\./i.test(text)) return blocked
  const allowedUrls = new Set(knowledge.match(URL) ?? [])
  if ((text.match(URL) ?? []).some(url => !allowedUrls.has(url))) return blocked
  // URLに埋め込まれた数字は上の完全一致で検証し、本文の数字は資料にあるものだけ許す。
  const numbers = (value: string) => boundedText(value.replace(URL, ''), 30000).match(/\d+(?:[.,:/-]\d+)*/g) ?? []
  const allowedNumbers = new Set(numbers(knowledge))
  if (numbers(text).some(n => !allowedNumbers.has(n))) return blocked
  // ペルソナや長い資料の逐語出力を止める。通常の短い案内は許す。
  const compact = (value: string) => boundedText(value, 30000).replace(/\s/g, '')
  const reply = compact(text)
  const persona = compact(input.personaPrompt ?? '')
  for (let i = 0; i + 20 <= reply.length; i++) {
    if (persona.includes(reply.slice(i, i + 20))) return blocked
  }
  const source = compact(knowledge)
  for (let i = 0; i + 60 <= reply.length; i++) {
    if (source.includes(reply.slice(i, i + 60))) return blocked
  }
  return { draft: text, needsHuman: false }
}
