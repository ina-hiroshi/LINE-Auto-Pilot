import type { SupabaseClientType } from '../../_shared/types.ts'
import { ClientVisibleError, toErrorMessage } from '../../_shared/error-utils.ts'

export type BusinessHourSlot = { start: string; end: string }
export type BusinessHoursByDay = Partial<Record<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', BusinessHourSlot[]>>

/** 暦日 YYYY-MM-DD の曜日 0=日 … 6=土（実行環境のタイムゾーンに依存しない） */
export function getJstDayOfWeek(targetDate: string): number {
  const [year, month, day] = targetDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Edge（UTC）でも JST の時刻ラベル（HH:MM）を返す */
export function formatTimeInJst(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
}

export const parseBusinessHours = (businessHoursRaw: unknown, targetDate: string): BusinessHourSlot[] => {
  try {
    const parsed = (businessHoursRaw ?? {}) as BusinessHoursByDay
    const dayOfWeek = getJstDayOfWeek(targetDate)
    const weekdayKey = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayOfWeek] ?? 'mon') as keyof BusinessHoursByDay
    const slots = parsed?.[weekdayKey]
    if (!Array.isArray(slots)) return []
    return slots
      .map((s) => ({ start: s.start, end: s.end }))
      .filter((s) => !!s.start && !!s.end)
  } catch (_e) {
    return []
  }
}

// time は "HH:MM" または "HH:MM:SS" 形式を受け付ける
export const toJstDate = (date: string, time: string) => {
  const normalizedTime = time.slice(0, 5)
  return new Date(`${date}T${normalizedTime}:00+09:00`)
}

export const isOverlapping = (startA: Date, endA: Date, startB: Date, endB: Date) => startA < endB && endA > startB

/** 予約変更時に重複判定から除外する対象予約の文脈 */
export type ModifyExcludeContext = {
  reservationId: string
  googleEventId?: string
  lineUserId?: string
  staffId?: string | null
  staffName?: string
  startTimeIso: string
  endTimeIso: string
}

type GoogleEventLike = {
  id?: string
  start?: { dateTime?: string }
  end?: { dateTime?: string }
  summary?: string
  description?: string
}

type ReservationOverlapRow = {
  id: string
  status: string
  line_user_id?: string
  start_time: string
  end_time: string
  staff_id?: string | null
}

const MODIFY_TIME_TOLERANCE_MS = 15 * 60 * 1000

function normalizeGoogleEventId(id: string): string {
  return id.includes('@') ? id.split('@')[0]! : id
}

function googleEventIdsMatch(storedId: string | undefined, eventId: string | undefined): boolean {
  if (!storedId || !eventId) return false
  const a = normalizeGoogleEventId(storedId)
  const b = normalizeGoogleEventId(eventId)
  return a === b || eventId.startsWith(a) || storedId.startsWith(b)
}

function descriptionContainsReservationId(description: string | undefined, reservationId: string): boolean {
  if (!description) return false
  return (
    description.includes(reservationId) ||
    description.includes(`Reservation ID: ${reservationId}`) ||
    description.includes(`予約ID: ${reservationId}`)
  )
}

/** 変更対象予約を DB から読み込み、除外コンテキストを構築 */
export async function loadModifyExcludeContext(
  supabaseClient: SupabaseClientType,
  storeId: string,
  reservationId: string
): Promise<ModifyExcludeContext> {
  const { data, error } = await supabaseClient
    .from('reservations')
    .select('id, line_user_id, staff_id, google_event_id, store_id, status, start_time, end_time, staff:staff_members(name)')
    .eq('id', reservationId)
    .maybeSingle()

  if (error) throw new ClientVisibleError(toErrorMessage(error))
  if (!data || data.store_id !== storeId || data.status === 'cancelled') {
    throw new ClientVisibleError('変更対象の予約が見つかりません', 404)
  }

  const staffJoin = data.staff as { name?: string } | { name?: string }[] | null
  const staffName = Array.isArray(staffJoin) ? staffJoin[0]?.name : staffJoin?.name

  return {
    reservationId: data.id,
    googleEventId: data.google_event_id ?? undefined,
    lineUserId: data.line_user_id,
    staffId: data.staff_id,
    staffName,
    startTimeIso: data.start_time,
    endTimeIso: data.end_time,
  }
}

/** DB 予約が重複ブロック対象か（変更対象予約は常に false） */
export function reservationBlocksOverlap(
  reservation: ReservationOverlapRow,
  slotStart: Date,
  slotEnd: Date,
  modifyExclude?: ModifyExcludeContext,
  lineUserId?: string
): boolean {
  if (modifyExclude && reservation.id === modifyExclude.reservationId) return false
  if (reservation.status === 'temporary' && lineUserId && reservation.line_user_id === lineUserId) {
    return false
  }
  return isOverlapping(
    slotStart,
    slotEnd,
    new Date(reservation.start_time),
    new Date(reservation.end_time)
  )
}

/** 予約変更時: 変更対象に紐づく Google カレンダーイベントのみ除外（HPB 等の外部予約は除外しない） */
export function isExcludedGoogleEventForModify(
  event: GoogleEventLike,
  lineUserId: string | undefined,
  modifyExclude?: ModifyExcludeContext
): boolean {
  if (!modifyExclude) return false

  if (descriptionContainsReservationId(event.description, modifyExclude.reservationId)) {
    return true
  }

  if (googleEventIdsMatch(modifyExclude.googleEventId, event.id)) {
    return true
  }

  if (lineUserId && event.summary?.startsWith('【仮予約】')) {
    if (event.description?.includes(lineUserId)) return true
  }

  if (!event.start?.dateTime || !event.end?.dateTime) {
    return false
  }

  const eventStart = new Date(event.start.dateTime)
  const eventEnd = new Date(event.end.dateTime)
  const oldStart = new Date(modifyExclude.startTimeIso)
  const oldEnd = new Date(modifyExclude.endTimeIso)

  const startDiff = Math.abs(eventStart.getTime() - oldStart.getTime())
  const endDiff = Math.abs(eventEnd.getTime() - oldEnd.getTime())

  const looksLikeOwnReservationEvent =
    event.summary?.startsWith('予約:') ||
    event.summary?.startsWith('【仮予約】') ||
    (modifyExclude.lineUserId != null && event.description?.includes(modifyExclude.lineUserId)) ||
    (modifyExclude.staffName != null &&
      event.summary?.startsWith('予約:') &&
      event.description?.includes(modifyExclude.staffName))

  // 変更前時間帯と重なり、かつ自店 LIFF 予約形式 → 変更対象の Google イベント
  if (looksLikeOwnReservationEvent && isOverlapping(oldStart, oldEnd, eventStart, eventEnd)) {
    return true
  }

  // 開始・終了が変更前予約とほぼ同じ＝同一イベント（自予約のみ）
  if (
    looksLikeOwnReservationEvent &&
    startDiff < MODIFY_TIME_TOLERANCE_MS &&
    endDiff < MODIFY_TIME_TOLERANCE_MS
  ) {
    return true
  }

  // 開始時刻が変更前予約とほぼ同じ（自予約のみ）
  if (looksLikeOwnReservationEvent && startDiff < MODIFY_TIME_TOLERANCE_MS) {
    return true
  }

  if (modifyExclude.lineUserId && event.description?.includes(modifyExclude.lineUserId)) {
    if (isOverlapping(oldStart, oldEnd, eventStart, eventEnd)) {
      return true
    }
  }

  // 本予約（予約:）で説明に LINE ID があり、変更前の時間帯と重なる
  if (
    modifyExclude.lineUserId &&
    event.summary?.startsWith('予約:') &&
    event.description?.includes(modifyExclude.lineUserId) &&
    isOverlapping(oldStart, oldEnd, eventStart, eventEnd)
  ) {
    return true
  }

  // レガシー: LINE ID 未記載でも、担当スタッフ名＋変更前時間帯が一致すれば自予約とみなす
  if (
    modifyExclude.staffName &&
    event.summary?.startsWith('予約:') &&
    event.description?.includes(modifyExclude.staffName) &&
    isOverlapping(oldStart, oldEnd, eventStart, eventEnd) &&
    startDiff < MODIFY_TIME_TOLERANCE_MS
  ) {
    return true
  }

  // 最終フォールバック: 開始・終了が変更前予約と同時一致 → 形式に関わらず変更対象
  if (startDiff < MODIFY_TIME_TOLERANCE_MS && endDiff < MODIFY_TIME_TOLERANCE_MS) {
    return true
  }

  // 開始時刻がほぼ完全一致（60秒以内）
  if (startDiff < 60 * 1000) {
    return true
  }

  return false
}

export function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid) return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

export function isValidDate(date: string | null | undefined): boolean {
  if (!date) return false
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) return false

  const [year, month, day] = date.split('-').map(Number)
  const dateObj = new Date(year, month - 1, day)
  return dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day
}

export function isValidTime(time: string | null | undefined): boolean {
  if (!time) return false
  const timeRegex = /^\d{2}:\d{2}$/
  if (!timeRegex.test(time)) return false

  const [hours, minutes] = time.split(':').map(Number)
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60
}

export function isPastDate(date: string, time: string): boolean {
  const dateTime = new Date(`${date}T${time}:00+09:00`)
  const now = new Date()
  return dateTime < now
}

function normalizeTimeToHm(time: string): string {
  return time.slice(0, 5)
}

export type StaffWorkPatternRow = {
  start_time?: string | null
  end_time?: string | null
  slots?: { start?: string; end?: string }[] | null
  is_active?: boolean | null
}

export type StaffSpecialScheduleRow = {
  is_absent?: boolean | null
  override_start?: string | null
  override_end?: string | null
}

/** スタッフの有効勤務時間帯（基本シフト + 特定日上書き） */
export function resolveStaffEffectiveHours(
  workPattern: StaffWorkPatternRow | null,
  specialSchedule: StaffSpecialScheduleRow | null
): BusinessHourSlot[] {
  if (specialSchedule?.is_absent) return []

  if (specialSchedule?.override_start && specialSchedule?.override_end) {
    return [{
      start: normalizeTimeToHm(specialSchedule.override_start),
      end: normalizeTimeToHm(specialSchedule.override_end),
    }]
  }

  if (!workPattern?.is_active) return []

  if (workPattern.slots && Array.isArray(workPattern.slots) && workPattern.slots.length > 0) {
    const ranges = workPattern.slots
      .filter((s) => s.start && s.end)
      .map((s) => ({
        start: normalizeTimeToHm(s.start!),
        end: normalizeTimeToHm(s.end!),
      }))
    if (ranges.length > 0) return ranges
  }

  if (workPattern.start_time && workPattern.end_time) {
    return [{
      start: normalizeTimeToHm(workPattern.start_time),
      end: normalizeTimeToHm(workPattern.end_time),
    }]
  }

  return []
}

/** JST の暦日 YYYY-MM-DD */
export function getJstDateString(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

export function isWithinMaxBookingDays(date: string, maxDays: number): boolean {
  const targetDate = new Date(`${date}T00:00:00+09:00`)
  const nowJst = getJstDateString(new Date())
  const [y, m, d] = nowJst.split('-').map(Number)
  const maxDate = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+09:00`)
  maxDate.setDate(maxDate.getDate() + maxDays)
  return targetDate <= maxDate
}

export async function getStoreSettings(supabaseClient: SupabaseClientType, id: string) {
  const { data, error } = await supabaseClient
    .from('stores')
    .select('slot_interval_minutes, capacity_per_slot, business_hours, max_booking_days, booking_enable_staff')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new ClientVisibleError(toErrorMessage(error))
  if (!data) throw new ClientVisibleError('店舗が見つかりません')
  return data
}

export type StaffInfo = { id: string; name: string }

export async function getWorkingStaffForTimeSlot(
  supabaseClient: SupabaseClientType,
  store_id: string,
  date: string,
  slotStart: Date,
  slotEnd: Date
): Promise<StaffInfo[]> {
  const dayOfWeek = getJstDayOfWeek(date)

  const { data: allStaff } = await supabaseClient
    .from('staff_members')
    .select('id, name')
    .eq('store_id', store_id)
    .eq('is_active', true)

  if (!allStaff || allStaff.length === 0) return []

  const { data: workPatterns } = await supabaseClient
    .from('staff_work_patterns')
    .select('staff_id, start_time, end_time, slots, is_active')
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .in('staff_id', allStaff.map(s => s.id))

  const { data: specialSchedules } = await supabaseClient
    .from('staff_special_schedules')
    .select('staff_id, is_absent, override_start, override_end')
    .eq('date', date)
    .in('staff_id', allStaff.map(s => s.id))

  const workingStaffIds = new Set<string>()

  for (const staff of allStaff) {
    const special = specialSchedules?.find(s => s.staff_id === staff.id)
    const pattern = workPatterns?.find(p => p.staff_id === staff.id)
    const effectiveHours = resolveStaffEffectiveHours(pattern ?? null, special ?? null)

    for (const range of effectiveHours) {
      const workStart = toJstDate(date, range.start)
      const workEnd = toJstDate(date, range.end)
      if (isOverlapping(slotStart, slotEnd, workStart, workEnd)) {
        workingStaffIds.add(staff.id)
        break
      }
    }
  }

  return allStaff.filter(s => workingStaffIds.has(s.id))
}

export function extractStaffFromGoogleEvent(
  event: { summary?: string; description?: string },
  staffList: StaffInfo[]
): StaffInfo | null {
  const searchText = `${event.summary || ''} ${event.description || ''}`.toLowerCase()

  for (const staff of staffList) {
    if (staff.name && searchText.includes(staff.name.toLowerCase())) {
      return staff
    }
  }
  return null
}

export function analyzeGoogleEventsForStaff(
  googleEvents: { start?: { dateTime?: string }; end?: { dateTime?: string }; summary?: string; description?: string }[],
  staffList: StaffInfo[],
  slotStart: Date,
  slotEnd: Date
): { identifiedStaffIds: string[]; unknownEventCount: number } {
  const identifiedStaffIds: string[] = []
  let unknownEventCount = 0

  for (const event of googleEvents) {
    if (!event.start?.dateTime || !event.end?.dateTime) continue

    const eventStart = new Date(event.start.dateTime)
    const eventEnd = new Date(event.end.dateTime)

    if (!isOverlapping(slotStart, slotEnd, eventStart, eventEnd)) continue

    const staff = extractStaffFromGoogleEvent(event, staffList)
    if (staff) {
      identifiedStaffIds.push(staff.id)
    } else {
      unknownEventCount++
    }
  }

  return { identifiedStaffIds, unknownEventCount }
}
