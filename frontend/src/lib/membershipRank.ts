/** 会員証のランク設定（ポイント数がしきい値以上ならそのランク） */
export type RankSetting = {
  name: string
  threshold: number
}

/** 店舗がランクを設定していない場合の既定 */
export const DEFAULT_RANK_SETTINGS: RankSetting[] = [
  { name: 'Bronze', threshold: 0 },
  { name: 'Silver', threshold: 100 },
  { name: 'Gold', threshold: 500 },
]

/**
 * DB の membership_rank_settings は jsonb で、
 * 空配列・null・想定外の形が入りうる。使える設定だけを取り出す。
 */
export function normalizeRankSettings(raw: unknown): RankSetting[] {
  if (!Array.isArray(raw)) return DEFAULT_RANK_SETTINGS

  const valid = raw
    .filter((r): r is { name: unknown; threshold: unknown } => typeof r === 'object' && r !== null)
    .map((r) => ({ name: String(r.name ?? ''), threshold: Number(r.threshold) }))
    .filter((r) => r.name !== '' && Number.isFinite(r.threshold))

  return valid.length > 0 ? valid : DEFAULT_RANK_SETTINGS
}

/**
 * ポイント残高からランク名を決める。
 *
 * しきい値の降順に見て最初に到達しているものを採用する。
 * どのしきい値にも届かない場合は最下位ランクを名乗らせる
 * （ランク無しとして空欄にすると会員証の表示が崩れるため）。
 */
export function resolveMembershipRank(points: number, rawSettings: unknown): string {
  const settings = normalizeRankSettings(rawSettings)
  const sorted = [...settings].sort((a, b) => b.threshold - a.threshold)

  const reached = sorted.find((r) => points >= r.threshold)
  return reached ? reached.name : sorted[sorted.length - 1].name
}

/** 会員番号は LINE ユーザーIDの先頭8文字（大文字） */
export function formatMemberNo(lineUserId: string | null | undefined): string {
  if (!lineUserId) return ''
  return lineUserId.substring(0, 8).toUpperCase()
}
