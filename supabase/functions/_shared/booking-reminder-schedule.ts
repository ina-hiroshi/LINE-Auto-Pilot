/**
 * 予約開始時刻（UTC）と店舗設定から、リマインド送信予定時刻（UTC の epoch ms）を求める。
 * 予約「日」は Asia/Tokyo の暦日。N 日前の HH:mm（JST）に送る。
 */
export function computeReminderDueMs(
  startTimeIso: string,
  daysBefore: number,
  timeHHmm: string,
): number {
  const start = new Date(startTimeIso)
  const ymdTokyo = start.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  const midnightJstMs = new Date(`${ymdTokyo}T00:00:00+09:00`).getTime()
  const reminderDayMidnightMs = midnightJstMs - daysBefore * 86400000
  const reminderYmd = new Date(reminderDayMidnightMs).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Tokyo',
  })
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeHHmm.trim())
  const hh = m ? String(Number(m[1])).padStart(2, '0') : '18'
  const mm = m ? m[2] : '00'
  return new Date(`${reminderYmd}T${hh}:${mm}:00+09:00`).getTime()
}

/** Cron 実行時: このリマインド時刻が「直近 windowMs 以内に到来した」ものを送る */
export function isReminderDueInWindow(
  reminderDueMs: number,
  nowMs: number,
  windowMs: number,
): boolean {
  return reminderDueMs <= nowMs && reminderDueMs > nowMs - windowMs
}
