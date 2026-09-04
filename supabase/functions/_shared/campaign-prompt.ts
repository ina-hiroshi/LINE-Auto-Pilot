/**
 * 一斉配信メッセージの下書きを AI に作らせるためのプロンプト。
 *
 * 自動応答（ai-prompt.ts）とは目的が違うので別モジュールにする。
 * 自動応答は「1人の質問に答える」、こちらは「不特定多数へ送る案内文を書く」。
 */

export type CampaignTone = 'friendly' | 'polite' | 'casual'

export type CampaignPromptInput = {
  storeName: string | null
  /** 業種（stores.industry）。文体や訴求の当たりを付けるのに使う */
  industry?: string | null
  segmentType: string
  /** メニュー名・スタッフ名など、対象をさらに具体化する情報 */
  targetDetail?: string | null
  /** 配信の目的（利用者の自由記述） */
  purpose: string
  tone: CampaignTone
  /** 盛り込みたい内容（キャンペーン名・特典・期日など） */
  keywords?: string | null
}

export const CAMPAIGN_VARIATION_COUNT = 3

const SEGMENT_AUDIENCE: Record<string, string> = {
  all: 'お店のLINE友だち全員',
  visited: '一度以上ご来店いただいたことのあるお客様',
  prospective: 'LINE友だち登録はしているが、まだ一度もご来店のないお客様',
  dormant: '以前ご来店いただいたが、しばらく足が遠のいているお客様',
  recent: 'ごく最近ご来店いただいたばかりのお客様',
  repeat: '繰り返しご来店いただいている常連のお客様',
  menu: '特定のメニューをご利用になったことがあるお客様',
  staff: '特定のスタッフが担当したお客様',
  high_spender: '累計のご利用金額が特に多い、上得意のお客様',
  manual: '店舗が個別に選んだお客様',
}

const TONE_LABEL: Record<CampaignTone, string> = {
  friendly: '親しみやすく、気さくな',
  polite: '丁寧で落ち着いた',
  casual: 'カジュアルで軽やかな',
}

export function buildCampaignPrompt(input: CampaignPromptInput): string {
  const audience = SEGMENT_AUDIENCE[input.segmentType] ?? 'お店のお客様'
  const tone = TONE_LABEL[input.tone] ?? TONE_LABEL.friendly
  const storeName = input.storeName?.trim() || '当店'

  const industry = input.industry?.trim()

  const lines = [
    `あなたは「${storeName}」${industry ? `（業種: ${industry}）` : ''}のスタッフとして、LINE公式アカウントから送る一斉配信メッセージの下書きを作成します。`,
    '',
    '# 配信の条件',
    `- 送る相手: ${audience}`,
  ]

  if (input.targetDetail?.trim()) {
    lines.push(`- 相手の具体的な条件: ${input.targetDetail.trim()}`)
  }

  lines.push(`- 配信の目的: ${input.purpose.trim()}`)
  lines.push(`- 文章のトーン: ${tone}文体`)

  if (input.keywords?.trim()) {
    lines.push(`- 必ず盛り込む内容: ${input.keywords.trim()}`)
  }

  lines.push(
    '',
    '# 守ること',
    '- 全員に同じ文面がそのまま届きます。「〇〇様」のような宛名や、氏名・来店日などの差し込み用プレースホルダは書かないこと。',
    '- 上に書かれていない事実を作らないこと。割引率・金額・期限・新メニュー名・営業時間などは、条件として与えられていない限り一切書かない。',
    '- Markdown記法（**、#、- など）は使わない。LINEではそのまま記号として表示される。',
    '- 絵文字は多くても2つまで。',
    '- 全体で120〜200文字程度。スマートフォンで一目で読める長さにする。',
    '- 最後に、来店予約や返信など次の行動につながる一文を入れる。',
    '- 送信者は店舗スタッフであり、AIであることには触れない。',
    '',
    '# 出力形式',
    `以下の形式のJSONだけを出力すること。説明文やコードブロックは付けない。異なる切り口の案を${CAMPAIGN_VARIATION_COUNT}つ作る。`,
    '{"variations":[{"text":"1案目の本文"},{"text":"2案目の本文"},{"text":"3案目の本文"}]}',
  )

  return lines.join('\n')
}

/**
 * Gemini の応答から本文候補を取り出す。
 * コードブロックで包んで返してくることがあるため、剥がしてからパースする。
 */
export function parseCampaignVariations(aiResponse: string): string[] {
  const fenced = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
    aiResponse.match(/```\s*([\s\S]*?)\s*```/)
  const jsonText = (fenced ? fenced[1] : aiResponse).trim()

  try {
    const parsed = JSON.parse(jsonText)
    const variations = Array.isArray(parsed) ? parsed : parsed?.variations
    if (!Array.isArray(variations)) return []

    return variations
      .map((item: unknown) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'text' in item) {
          return String((item as { text: unknown }).text)
        }
        return ''
      })
      .map((text) => text.trim())
      .filter((text) => text.length > 0)
  } catch {
    return []
  }
}
