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

/**
 * ステータスの色。隣り合う色が見分けられるよう dataviz の validate_palette で検証済み
 * （青・紫・赤・緑の4色 + 脇役の灰色）。要対応は赤で固定し、画面側でアイコンと文言も併記する。
 */
export const STATUS_COLORS = {
  auto_replied: '#2a78d6',
  ai_replied: '#4a3aa7',
  manual_reply_needed: '#d03b3b',
  manual_replied: '#1baf7a',
  resolved: '#a8b0bc',
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

// ---------------------------------------------------------------------------
// 期間連動の推移グラフ
//
// 以前は選択期間に関係なく「過去14日間」で描いていたため、「今日」を選ぶと13日ぶんが0件、
// 月初に「今月」を選ぶと前月ぶんが0件になり、「本当に0件だった」と誤読された。
// 推移グラフの横軸は、画面で選んだ期間そのものにそろえる。
// ---------------------------------------------------------------------------

export type TrendRange = 'today' | 'week' | 'month' | 'all'

export type TrendBucket = {
  /** 集計キー（日: YYYY-M-D / 時間帯: 0〜23） */
  key: string
  /** 軸ラベル（9/29 や 14時） */
  label: string
  /** ツールチップ用の長いラベル（9月29日(月) や 14時台） */
  fullLabel: string
  /** バケット開始時刻（ミリ秒）。未来判定に使う */
  startMs: number
}

export type TrendWindow = {
  granularity: 'hour' | 'day'
  buckets: TrendBucket[]
  /** カードの副題に出す期間の説明 */
  description: string
  /** 「1日あたり」「1時間あたり」など、平均の単位 */
  unitLabel: string
}

/** null は「まだ来ていない日」。線を今日で止めるため 0 と区別する */
export type TrendPoint = { key: string; label: string; fullLabel: string; count: number | null }

/** 「全期間」のとき推移グラフに出す日数 */
export const ALL_RANGE_TREND_DAYS = 30

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function dayBucket(d: Date): TrendBucket {
  return {
    key: dayKey(d),
    label: dateKey(d),
    fullLabel: `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAY_NAMES[d.getDay()]})`,
    startMs: d.getTime(),
  }
}

/** 選択期間に合わせた推移グラフの横軸を作る */
export function buildTrendWindow(range: TrendRange, now: Date): TrendWindow {
  const today = startOfDay(now)

  if (range === 'today') {
    const buckets: TrendBucket[] = []
    for (let h = 0; h < 24; h++) {
      buckets.push({
        key: String(h),
        label: `${h}時`,
        fullLabel: `${h}時台`,
        startMs: new Date(today.getFullYear(), today.getMonth(), today.getDate(), h).getTime(),
      })
    }
    return { granularity: 'hour', buckets, description: '今日（時間帯別）', unitLabel: '1時間あたり' }
  }

  if (range === 'week') {
    const start = new Date(today)
    start.setDate(today.getDate() - today.getDay()) // 日曜始まり（データ取得の範囲と同じ）
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return dayBucket(d)
    })
    return { granularity: 'day', buckets, description: '今週（日〜土）', unitLabel: '1日あたり' }
  }

  if (range === 'month') {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const buckets = Array.from({ length: daysInMonth }, (_, i) =>
      dayBucket(new Date(today.getFullYear(), today.getMonth(), i + 1)),
    )
    return { granularity: 'day', buckets, description: `今月（${today.getMonth() + 1}月）`, unitLabel: '1日あたり' }
  }

  const buckets = Array.from({ length: ALL_RANGE_TREND_DAYS }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (ALL_RANGE_TREND_DAYS - 1 - i))
    return dayBucket(d)
  })
  return { granularity: 'day', buckets, description: `直近${ALL_RANGE_TREND_DAYS}日間`, unitLabel: '1日あたり' }
}

function bucketKeyOf(window: TrendWindow, ts: string, today: Date): string | null {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  if (window.granularity === 'hour') {
    return dayKey(d) === dayKey(today) ? String(d.getHours()) : null
  }
  return dayKey(d)
}

/**
 * 横軸に沿って件数を数える。
 * `hideFuture` が true のとき、まだ来ていない日・時間帯は null（過去の実績を描くグラフ用）。
 * 予約のように未来の予定が入るものは false にして 0 件も含めて描く。
 */
export function buildTrendCounts(
  window: TrendWindow,
  now: Date,
  timestamps: string[],
  hideFuture: boolean,
): TrendPoint[] {
  const today = startOfDay(now)
  const map = new Map(window.buckets.map((b) => [b.key, 0]))
  for (const ts of timestamps) {
    const key = bucketKeyOf(window, ts, today)
    if (key !== null && map.has(key)) map.set(key, (map.get(key) ?? 0) + 1)
  }
  return window.buckets.map((b) => ({
    key: b.key,
    label: b.label,
    fullLabel: b.fullLabel,
    count: hideFuture && b.startMs > now.getTime() ? null : (map.get(b.key) ?? 0),
  }))
}

/** 横軸に沿ったユニークユーザー数（同じバケット内の重複 line_user_id は1人として数える） */
export function buildTrendUniqueUserCounts(
  window: TrendWindow,
  now: Date,
  rows: { created_at: string; line_user_id: string }[],
): TrendPoint[] {
  const today = startOfDay(now)
  const map = new Map<string, Set<string>>(window.buckets.map((b) => [b.key, new Set<string>()]))
  for (const row of rows) {
    const key = bucketKeyOf(window, row.created_at, today)
    if (key !== null) map.get(key)?.add(row.line_user_id)
  }
  return window.buckets.map((b) => ({
    key: b.key,
    label: b.label,
    fullLabel: b.fullLabel,
    count: b.startMs > now.getTime() ? null : (map.get(b.key)?.size ?? 0),
  }))
}

export type TrendSummary = {
  /** 期間内の合計（null は除く） */
  total: number
  /** バケットあたりの平均（小数第1位まで）。実績のあるバケットが無ければ 0 */
  average: number
  /** 最多のバケット。全部0件なら null */
  peak: { label: string; fullLabel: string; count: number } | null
}

/** 推移グラフの見出しに出す「合計・平均・ピーク」 */
export function summarizeTrend(points: TrendPoint[]): TrendSummary {
  let total = 0
  let observed = 0
  let peak: TrendSummary['peak'] = null
  for (const p of points) {
    if (p.count === null) continue
    total += p.count
    observed += 1
    if (p.count > 0 && (peak === null || p.count > peak.count)) {
      peak = { label: p.label, fullLabel: p.fullLabel, count: p.count }
    }
  }
  const average = observed === 0 ? 0 : Math.round((total / observed) * 10) / 10
  return { total, average, peak }
}

/** 曜日別のうち最多の曜日（同数は複数）。全部0件なら空 */
export function findPeakWeekdays(points: WeekdayPoint[]): string[] {
  const max = Math.max(0, ...points.map((p) => p.count))
  if (max === 0) return []
  return points.filter((p) => p.count === max).map((p) => p.day)
}
