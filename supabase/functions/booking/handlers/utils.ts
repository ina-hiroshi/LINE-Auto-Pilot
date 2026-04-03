import type { SupabaseClientType } from '../../_shared/types.ts'
import { ClientVisibleError, toErrorMessage } from '../../_shared/error-utils.ts'

export type BusinessHourSlot = { start: string; end: string }
export type BusinessHoursByDay = Partial<Record<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', BusinessHourSlot[]>>

/** 日本のカレンダー日付（YYYY-MM-DD）に対応する曜日 0=日 … 6=土（getDay と同じ） */
export function getJstDayOfWeek(targetDate: string): number {
  return new Date(`${targetDate}T00:00:00+09:00`).getDay()
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

export function isWithinMaxBookingDays(date: string, maxDays: number): boolean {
  const targetDate = new Date(`${date}T00:00:00+09:00`)
  const maxDate = new Date()
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

    if (special?.is_absent) continue

    const pattern = workPatterns?.find(p => p.staff_id === staff.id)
    if (!pattern) continue

    if (special?.override_start && special?.override_end) {
      const workStart = toJstDate(date, special.override_start)
      const workEnd = toJstDate(date, special.override_end)
      if (isOverlapping(slotStart, slotEnd, workStart, workEnd)) {
        workingStaffIds.add(staff.id)
      }
      continue
    }

    if (pattern.slots && Array.isArray(pattern.slots) && pattern.slots.length > 0) {
      for (const slot of pattern.slots) {
        if (slot.start && slot.end) {
          const workStart = toJstDate(date, slot.start)
          const workEnd = toJstDate(date, slot.end)
          if (isOverlapping(slotStart, slotEnd, workStart, workEnd)) {
            workingStaffIds.add(staff.id)
            break
          }
        }
      }
      continue
    }

    if (pattern.start_time && pattern.end_time) {
      const workStart = toJstDate(date, pattern.start_time)
      const workEnd = toJstDate(date, pattern.end_time)
      if (isOverlapping(slotStart, slotEnd, workStart, workEnd)) {
        workingStaffIds.add(staff.id)
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
