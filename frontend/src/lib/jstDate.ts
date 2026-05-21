import { getJstDateString } from './reservationStatus'

/** 暦日 YYYY-MM-DD の曜日 0=日 … 6=土（実行環境のタイムゾーンに依存しない） */
export function getJstDayOfWeek(targetDate: string): number {
  const [year, month, day] = targetDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** JST の今日 YYYY-MM-DD */
export function getJstTodayString(): string {
  return getJstDateString(new Date())
}

/** JST の今日から offset 日後の YYYY-MM-DD */
export function getJstDateStringWithOffset(offsetDays: number): string {
  const [year, month, day] = getJstTodayString().split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day + offsetDays))
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** JST で日付文字列を表示用にフォーマット */
export function formatJstDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00+09:00`)
  return d.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

export { getJstDateString }
