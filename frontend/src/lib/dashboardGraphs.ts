/**
 * ダッシュボードのグラフ集計。
 *
 * pages/Dashboard.tsx にインラインで書かれていた集計ロジックを
 * 副作用（setState）と切り離してテストできるようにした。
 * `now` を引数で受け取るのは、日付境界のテストを実時刻に依存させないため。
 */

export type DailyPoint = { date: string; count: number }
export type WeekdayPoint = { day: string; count: number }
export type StatusPoint = { name: string; value: number; color: string }
export type NameCountPoint = { name: string; count: number }

export const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'] as const

export const STATUS_COLORS = {
  auto_replied: '#0d9488',
  ai_replied: '#2563eb',
  manual_reply_needed: '#dc2626',
  manual_replied: '#0f766e',
  resolved: '#94a3b8',
} as const

/** グラフの集計キー。年をまたぐ集計はしない（trailing days が短いため月/日だけで一意） */
function dateKey(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** `now` を含めて過去 `days` 日ぶんの日付キーを古い順に並べる */
export function buildTrailingDayKeys(now: Date, days: number): string[] {
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    keys.push(dateKey(d))
  }
  return keys
}

/** 日別件数。集計対象外（trailing days の範囲外）の日付は無視する */
export function buildDailyCounts(now: Date, days: number, timestamps: string[]): DailyPoint[] {
  const map = new Map(buildTrailingDayKeys(now, days).map((k) => [k, 0]))
  for (const ts of timestamps) {
    const key = dateKey(new Date(ts))
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries()).map(([date, count]) => ({ date, count }))
}

/** 日別ユニークユーザー数（同日内の重複 line_user_id は1件として数える） */
export function buildDailyUniqueUserCounts(
  now: Date,
  days: number,
  rows: { created_at: string; line_user_id: string }[],
): DailyPoint[] {
  const map = new Map<string, Set<string>>(buildTrailingDayKeys(now, days).map((k) => [k, new Set<string>()]))
  for (const row of rows) {
    const key = dateKey(new Date(row.created_at))
    map.get(key)?.add(row.line_user_id)
  }
  return Array.from(map.entries()).map(([date, set]) => ({ date, count: set.size }))
}

/** 曜日別件数。日本語の曜日名（日曜始まり）で返す */
export function buildWeekdayCounts(timestamps: string[]): WeekdayPoint[] {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const ts of timestamps) counts[new Date(ts).getDay()] += 1
  return WEEKDAY_NAMES.map((day, i) => ({ day, count: counts[i] }))
}

/** ステータス別の内訳。0件のステータスはグラフに出さない */
export function buildStatusDistribution(statuses: string[]): StatusPoint[] {
  const map = new Map<string, number>()
  for (const s of statuses) map.set(s, (map.get(s) ?? 0) + 1)

  return [
    { name: '自動応答', value: map.get('auto_replied') ?? 0, color: STATUS_COLORS.auto_replied },
    { name: 'AI応答', value: map.get('ai_replied') ?? 0, color: STATUS_COLORS.ai_replied },
    { name: '要対応', value: map.get('manual_reply_needed') ?? 0, color: STATUS_COLORS.manual_reply_needed },
    { name: '手動返信', value: map.get('manual_replied') ?? 0, color: STATUS_COLORS.manual_replied },
    { name: '対応済', value: map.get('resolved') ?? 0, color: STATUS_COLORS.resolved },
  ].filter((item) => item.value > 0)
}

/**
 * ID別件数を名前に変換して上位 `limit` 件を返す（多い順）。
 * 名前が引けない ID（削除済みメニュー・スタッフ等）は「未設定」にまとめる。
 */
export function buildTopNameCounts(
  ids: (string | null | undefined)[],
  nameById: Map<string, string>,
  limit = 10,
): NameCountPoint[] {
  const counts = new Map<string, number>()
  for (const id of ids) {
    if (!id) continue
    const name = nameById.get(id) || '未設定'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
