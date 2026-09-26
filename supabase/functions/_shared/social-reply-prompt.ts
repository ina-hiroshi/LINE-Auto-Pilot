/**
 * DM への返信文を作るプロンプト。2つの用途で使う。
 *
 * - mode: 'draft'（既定）… DM 受信箱の「AI下書き」。生成結果は管理画面の
 *   返信フォームに入るだけで、人が確認してから送る。
 * - mode: 'auto' … social-dm-poll の AI 自動応答。キーワードルールに
 *   当たらなかった DM に対して生成し、送信キューへ積む。人の確認が
 *   入らないので、店舗情報で答えられないときは needsHuman で返させ、
 *   呼び出し側で送信を止める。
 *
 * campaign-prompt.ts と同じガードレール（プレースホルダ禁止・事実の
 * 捏造禁止・Markdown禁止・文字数制限・JSONで返させる）を踏襲する。
 * knowledgeText には LINE の AI 応答と同じ学習データ（_shared/store-knowledge.ts）
 * を渡す。LINE 用の generateSystemPrompt は「LINE公式アカウント」
 * 「メニューの予約から」など LINE 前提の文言を含むため流用しない。
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
  /** 店舗の AI 学習データ。空なら「店舗情報なし」として扱う。 */
  knowledgeText?: string | null
  tone?: 'polite' | 'friendly'
  personaPrompt?: string | null
  mode?: 'draft' | 'auto'
}

const PLATFORM_LABEL: Record<SocialReplyPromptInput['platform'], string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
}

/** プロンプトに載せる直近メッセージの上限（古いものから切り捨てる）。 */
export const SOCIAL_REPLY_HISTORY_MAX_MESSAGES = 10

/** 返信文の文字数上限。店舗情報の案内（URL 等）が入る分、LINE より少し長めに取る。 */
export const SOCIAL_REPLY_MAX_CHARS = 200

export function buildSocialReplyPrompt(input: SocialReplyPromptInput): string {
  const storeName = input.storeName?.trim() || '当店'
  const platformLabel = PLATFORM_LABEL[input.platform]
  const displayName = input.displayName?.trim() || '相手'
  const knowledge = input.knowledgeText?.trim() || ''
  const mode = input.mode ?? 'draft'

  const history = input.recentMessages
    .slice(-SOCIAL_REPLY_HISTORY_MAX_MESSAGES)
    .filter((m) => m.text && m.text.trim().length > 0)
    .map((m) => `${m.direction === 'inbound' ? displayName : storeName}: ${m.text}`)
    .join('\n')

  const tone = input.tone === 'friendly' ? 'フレンドリーで親しみやすい口調' : '丁寧でフォーマルな口調'

  const lines = [
    mode === 'auto'
      ? `あなたは「${storeName}」のスタッフとして、${platformLabel} の DM に自動で返信します。返信は確認なしでそのまま相手に送られます。`
      : `あなたは「${storeName}」のスタッフとして、${platformLabel} の DM に返信する下書きを1件だけ作成します。`,
    '',
    '# 店舗情報',
    knowledge || '（登録されていません）',
    '',
    '# これまでのやり取り（古い→新しい）',
    history || '（まだやり取りはありません）',
    '',
    '# 守ること',
    '- 直前の相手のメッセージに対して、次の1通として自然に返す内容にする。',
    '- 「〇〇様」のような宛名や、氏名・来店日などの差し込み用プレースホルダは書かない。',
    '- 店舗情報とここまでの文脈に書かれている事実だけを使う。書かれていない割引率・金額・期限・メニュー名・営業時間・在庫状況などを勝手に断定しない。',
    '- DM 上で予約や申込を確定させない。手続きが必要な場合は、店舗情報にある案内先を伝える。',
    '- Markdown記法（**、#、- など）は使わない。',
    '- 絵文字は多くても1つまで。',
    `- 全体で${SOCIAL_REPLY_MAX_CHARS}文字以内。DMで読みやすい短さにする。`,
    '- 送信者は店舗スタッフであり、AI・データベース・学習データなどの内部用語には触れない。',
    `- ${tone}で書く。`,
  ]

  if (input.personaPrompt?.trim()) {
    lines.push(`- 追加の役割指示: ${input.personaPrompt.trim()}`)
  }

  lines.push(
    '',
    '# 答えられない場合',
    mode === 'auto'
      ? '店舗情報から答えられない質問、苦情・トラブル・個別の相談など人が対応すべき内容の場合は、返信文を空にして needsHuman を true にする。挨拶やお礼には短く返してよい。'
      : '分からないことは正直に「確認してご連絡します」と伝える文面にし、needsHuman を true にする。',
    '',
    '# 出力形式',
    '以下の形式のJSONだけを出力すること。説明文やコードブロックは付けない。',
    '{"draft":"返信文","needsHuman":false}',
  )

  return lines.join('\n')
}

export type SocialReplyResult = {
  draft: string | null
  needsHuman: boolean
}

/**
 * Gemini の応答から返信文と needsHuman を取り出す。
 * コードブロックで包んで返してくることがあるため、剥がしてからパースする。
 * パースできなければ null（呼び出し側で「生成失敗」として扱う）。
 */
export function parseSocialReplyResult(aiResponse: string): SocialReplyResult | null {
  const fenced = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/```\s*([\s\S]*?)\s*```/)
  const jsonText = (fenced ? fenced[1] : aiResponse).trim()

  try {
    const parsed = JSON.parse(jsonText)
    const raw = typeof parsed === 'string' ? parsed : parsed?.draft
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    const needsHuman = typeof parsed === 'object' && parsed !== null && parsed.needsHuman === true
    if (!trimmed && !needsHuman) return null
    return { draft: trimmed || null, needsHuman }
  } catch {
    return null
  }
}

/** 下書き用途の互換ラッパー。本文が無ければ null。 */
export function parseSocialReplyDraft(aiResponse: string): string | null {
  return parseSocialReplyResult(aiResponse)?.draft ?? null
}
