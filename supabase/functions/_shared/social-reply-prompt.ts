/**
 * DM 受信箱の「AI下書き」用プロンプト。
 *
 * campaign-prompt.ts と同じガードレール（プレースホルダ禁止・事実の
 * 捏造禁止・Markdown禁止・文字数制限・JSONで返させる）を踏襲するが、
 * 目的が違うので別モジュールにする。campaign-prompt は「不特定多数へ
 * 送る案内文」、こちらは「1人からの DM に対する返信案」。
 *
 * 生成結果は social-draft-reply から返るだけで、どの経路からも
 * 自動送信はしない（管理画面の返信フォームに入るだけ）。
 */

export type SocialReplyMessage = {
  direction: 'inbound' | 'outbound' | 'echo'
  text: string | null
}

export type SocialReplyPromptInput = {
  storeName: string | null
  platform: 'instagram' | 'facebook'
  displayName: string | null
  /** 直近の会話（古い→新しい順）。文脈として渡すだけで、書き換えはしない。 */
  recentMessages: SocialReplyMessage[]
}

const PLATFORM_LABEL: Record<SocialReplyPromptInput['platform'], string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
}

/** プロンプトに載せる直近メッセージの上限（古いものから切り捨てる）。 */
export const SOCIAL_REPLY_HISTORY_MAX_MESSAGES = 10

export function buildSocialReplyPrompt(input: SocialReplyPromptInput): string {
  const storeName = input.storeName?.trim() || '当店'
  const platformLabel = PLATFORM_LABEL[input.platform]
  const displayName = input.displayName?.trim() || '相手'

  const history = input.recentMessages
    .slice(-SOCIAL_REPLY_HISTORY_MAX_MESSAGES)
    .filter((m) => m.text && m.text.trim().length > 0)
    .map((m) => `${m.direction === 'inbound' ? displayName : storeName}: ${m.text}`)
    .join('\n')

  return [
    `あなたは「${storeName}」のスタッフとして、${platformLabel} の DM に返信する下書きを1件だけ作成します。`,
    '',
    '# これまでのやり取り（古い→新しい）',
    history || '（まだやり取りはありません）',
    '',
    '# 守ること',
    '- 直前の相手のメッセージに対して、次の1通として自然に返す内容にする。',
    '- 「〇〇様」のような宛名や、氏名・来店日などの差し込み用プレースホルダは書かない。',
    '- ここまでの文脈に書かれていない事実を作らない。割引率・金額・期限・メニュー名・営業時間・在庫状況などを勝手に断定しない。分からないことは正直に「確認します」と伝える。',
    '- Markdown記法（**、#、- など）は使わない。',
    '- 絵文字は多くても1つまで。',
    '- 全体で150文字以内。DMで読みやすい短さにする。',
    '- 送信者は店舗スタッフであり、AIであることには触れない。',
    '',
    '# 出力形式',
    '以下の形式のJSONだけを出力すること。説明文やコードブロックは付けない。',
    '{"draft":"返信文"}',
  ].join('\n')
}

/**
 * Gemini の応答から下書き本文を取り出す。
 * コードブロックで包んで返してくることがあるため、剥がしてからパースする。
 */
export function parseSocialReplyDraft(aiResponse: string): string | null {
  const fenced = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/```\s*([\s\S]*?)\s*```/)
  const jsonText = (fenced ? fenced[1] : aiResponse).trim()

  try {
    const parsed = JSON.parse(jsonText)
    const draft = typeof parsed === 'string' ? parsed : parsed?.draft
    if (typeof draft !== 'string') return null
    const trimmed = draft.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}
