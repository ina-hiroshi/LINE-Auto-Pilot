/**
 * キーワード自動応答の選定ロジック。
 *
 * 受信したLINEメッセージに対してどのルールを返すかを決める、
 * サービスの中核判定。line-webhook から切り出してテスト可能にしている。
 */

export const SCORING = {
  /** キーワード完全一致時のスコア */
  EXACT_MATCH: 100,
  /** キーワード部分一致時のスコア */
  PARTIAL_MATCH: 30,
  /** サブキーワード一致時のスコア */
  SUB_KEYWORD_MATCH: 10,
  /** 自動応答を発動するしきい値 */
  THRESHOLD: 25,
  /** 部分一致時のキーワード長ボーナスの上限 */
  MAX_LENGTH_BONUS: 20,
} as const

export type ScorableRule = {
  keyword: string
  sub_keywords?: unknown
  [key: string]: unknown
}

/**
 * 表記ゆれを吸収する（小文字化・NFKC・空白除去・記号除去）。
 *
 * 記号除去が NFKC の後にある点に注意。NFKC は全角の `？`『！』を
 * ASCII の `?` `!` に変換するため、全角形だけを除去対象にすると
 * 「営業時間？」が「営業時間?」のまま残り、完全一致が成立しなくなる。
 * ASCII 形も除去対象に含める。
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[？！。、?!]/g, '')
}

/**
 * 正規化後に空になるキーワードは「全メッセージに一致する」ため使えない。
 *
 * `''.includes('')` も `'なんでも'.includes('')` も true になるので、
 * 空白だけのキーワード（管理画面から登録できてしまう）を1件でも有効にすると、
 * そのルールが全ての受信メッセージを横取りしてしまう。
 */
function isUsableKeyword(normalized: string): boolean {
  return normalized.length > 0
}

/** 1つのルールに対する一致スコアを返す */
export function scoreRule(normalizedText: string, rule: ScorableRule): number {
  let score = 0

  const normalizedKeyword = normalizeText(rule.keyword ?? '')
  if (!isUsableKeyword(normalizedKeyword)) return 0

  if (normalizedText === normalizedKeyword) {
    score = SCORING.EXACT_MATCH
  } else if (normalizedText.includes(normalizedKeyword)) {
    // 長いキーワードほど具体的とみなして加点する
    const lengthBonus = Math.min(rule.keyword.length * 2, SCORING.MAX_LENGTH_BONUS)
    score += SCORING.PARTIAL_MATCH + lengthBonus
  }

  if (Array.isArray(rule.sub_keywords)) {
    for (const sub of rule.sub_keywords) {
      if (typeof sub !== 'string') continue
      const normalizedSub = normalizeText(sub)
      if (!isUsableKeyword(normalizedSub)) continue
      if (normalizedText.includes(normalizedSub)) {
        score += SCORING.SUB_KEYWORD_MATCH
      }
    }
  }

  return score
}

export type AutoResponseMatch<T extends ScorableRule> = {
  rule: T
  score: number
}

/**
 * 定型文で足りる添え言葉。キーワードを除いた残りがこれだけなら
 * 「営業時間を教えてください」のように、キーワード応答で十分とみなす。
 * 長いものから順に削る。
 */
const POLITE_FILLERS = [
  'よろしくお願いします',
  'お願いいたします',
  'お願い致します',
  '教えてください',
  '教えて下さい',
  '知りたいです',
  'したいです',
  'お願いします',
  'でしょうか',
  'できますか',
  'しますか',
  'のですが',
  'んです',
  'します',
  'ください',
  '下さい',
  '教えて',
  '知りたい',
  'したい',
  'ですか',
  'ますか',
  'について',
  'のこと',
  'って',
  'です',
  'ます',
  'お願い',
  'かな',
  '店舗',
  'お店',
  'そちら',
  'を',
  'は',
  'が',
  'に',
  'の',
  'と',
  'も',
  'へ',
  'で',
  'や',
  'ね',
  'よ',
] as const

const NORMALIZED_FILLERS = [...POLITE_FILLERS]
  .map((filler) => normalizeText(filler))
  .filter((filler) => filler.length > 0)
  .sort((a, b) => b.length - a.length)

function leftoverAfterKeyword(normalizedText: string, normalizedKeyword: string): string {
  const index = normalizedText.indexOf(normalizedKeyword)
  if (index < 0) return normalizedText
  return normalizedText.slice(0, index) + normalizedText.slice(index + normalizedKeyword.length)
}

function stripPoliteFillers(normalized: string): string {
  let current = normalized
  let changed = true
  while (changed && current.length > 0) {
    changed = false
    for (const filler of NORMALIZED_FILLERS) {
      if (current.startsWith(filler)) {
        current = current.slice(filler.length)
        changed = true
        break
      }
      if (current.endsWith(filler)) {
        current = current.slice(0, -filler.length)
        changed = true
        break
      }
    }
  }
  return current
}

/**
 * キーワードには当たったが、定型文をそのまま返す前に AI 判定が必要なときに true。
 *
 * 例: 「予約」→「下のメニューから」に対する「予約をキャンセルしたい」
 * 完全一致と添え言葉だけの部分一致は false（判定せず定型文）。
 * AIがオフなら false（従来どおりキーワード応答を使う）。
 */
export function shouldDeferKeywordToAi(
  text: string,
  match: AutoResponseMatch<ScorableRule> | null,
  aiEnabled: boolean,
): boolean {
  if (!aiEnabled || !match) return false
  if (match.score >= SCORING.EXACT_MATCH) return false

  const leftover = stripPoliteFillers(
    leftoverAfterKeyword(normalizeText(text), normalizeText(match.rule.keyword)),
  )
  return leftover.length > 0
}

/**
 * しきい値を超える最良のルールを返す。該当が無ければ null（AI応答などへフォールバック）。
 *
 * 同点の場合はキーワードが長い方（より具体的な方）を優先する。
 */
export function selectAutoResponse<T extends ScorableRule>(
  text: string,
  rules: T[] | null | undefined,
): AutoResponseMatch<T> | null {
  if (!rules || rules.length === 0) return null

  const normalizedText = normalizeText(text)

  let bestScore = 0
  let bestRule: T | null = null
  let bestKeywordLength = 0

  for (const rule of rules) {
    const score = scoreRule(normalizedText, rule)
    const keywordLength = rule.keyword?.length ?? 0

    if (score > bestScore || (score === bestScore && keywordLength > bestKeywordLength)) {
      bestScore = score
      bestRule = rule
      bestKeywordLength = keywordLength
    }
  }

  if (!bestRule || bestScore < SCORING.THRESHOLD) return null

  return { rule: bestRule, score: bestScore }
}
