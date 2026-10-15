import { boundedText } from './ai-untrusted.ts'

type CountedName = { name: string; count: number }
export type AnalysisStats = {
  topCustomersByMessages: CountedName[]
  topCustomersByReservations: CountedName[]
  popularMenus: CountedName[]
  staffStats: CountedName[]
}
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const strings = (value: unknown, limit: number, maxChars: number): string[] => Array.isArray(value)
  ? value.filter((v): v is string => typeof v === 'string').slice(0, limit).map(v => boundedText(v, maxChars)).filter(Boolean) : []

/** AIの未知のキーや集計値は採用せず、表示用の型とサイズを確定する。 */
export function validateDashboardAnalysis(value: unknown, stats: AnalysisStats, sampleCount: number) {
  const data = record(value)
  let remaining = Math.max(0, Math.min(10, sampleCount))
  const categories = Array.isArray(data.questionCategories) ? data.questionCategories.slice(0, 8) : []
  const questionCategories = categories.flatMap(value => {
    const item = record(value)
    if (typeof item.category !== 'string' || typeof item.count !== 'number' || !Number.isInteger(item.count) || item.count < 0 || item.count > remaining) return []
    const category = boundedText(item.category, 100)
    if (!category) return []
    remaining -= item.count
    return [{ category, count: item.count, examples: strings(item.examples, 3, 300) }]
  })
  return {
    summary: boundedText(data.summary, 2000) || 'AI分析の解析に失敗しました。',
    insights: strings(data.insights, 8, 500),
    improvements: strings(data.improvements, 8, 500),
    reservationAnalysis: boundedText(data.reservationAnalysis, 2000),
    questionCategories,
    // モデルの応答とは関係なく、DBから集計した値を返す。
    ...stats,
  }
}
