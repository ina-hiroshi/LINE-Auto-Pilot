/**
 * 広告名 `業種_訴求_vN(_サフィックス)?` をパースする純粋関数。
 *
 * 実際の運用では命名規約から外れた広告（テスト用の思いつき名、手動で
 * 作った一過性の広告など）が必ず混ざる。パースできない名前を捨てると
 * その広告の成果がダッシュボードから消え、数字が合わなくなる。
 * 捨てずに「その他」バケットへ入れることで、合計は常に一致させる。
 */

export type ParsedAdName = {
  raw: string
  /** 命名規約に一致したか。false のときは industry/appeal が共に 'その他' */
  parsed: boolean
  industry: string
  appeal: string
  version: number | null
  suffix: string | null
}

export const UNPARSED_BUCKET = 'その他'

export function parseAdName(name: string): ParsedAdName {
  const parts = name.split('_')
  if (parts.length >= 3) {
    const versionMatch = parts[2].match(/^v(\d+)$/i)
    if (versionMatch && parts[0] && parts[1]) {
      return {
        raw: name,
        parsed: true,
        industry: parts[0],
        appeal: parts[1],
        version: Number(versionMatch[1]),
        suffix: parts.length > 3 ? parts.slice(3).join('_') : null,
      }
    }
  }
  return {
    raw: name,
    parsed: false,
    industry: UNPARSED_BUCKET,
    appeal: UNPARSED_BUCKET,
    version: null,
    suffix: null,
  }
}
