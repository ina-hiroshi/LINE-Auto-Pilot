export type ReservationStatus = 'confirmed' | 'paid' | 'cancelled' | 'temporary' | 'pending'

export const RESERVATION_STATUS_LABEL: Record<string, string> = {
  confirmed: '未決済',
  paid: '決済完了',
  cancelled: 'キャンセル',
  temporary: '仮予約',
  pending: '未決済',
}

export function getReservationStatusLabel(status: string): string {
  return RESERVATION_STATUS_LABEL[status] ?? status
}

export function getPaymentStatusBadgeClass(status: string): string {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800'
  if (status === 'cancelled') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-800'
}

/** JST の日付文字列 YYYY-MM-DD */
export function getJstDateString(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

/** 予約日が今日以前（JST）なら決済可能 */
export function canPayReservation(startTimeIso: string): boolean {
  const reservationDate = getJstDateString(new Date(startTimeIso))
  const today = getJstDateString(new Date())
  return reservationDate <= today
}

export function formatYen(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—'
  return `¥${amount.toLocaleString()}`
}

export function isLineCustomer(lineUserId: string | null | undefined): boolean {
  if (!lineUserId) return false
  return !lineUserId.startsWith('MANUAL_')
}
