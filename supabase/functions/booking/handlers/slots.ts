import type { SupabaseClientType } from '../../_shared/types.ts'
import type { CorsHeaders } from './types.ts'
import {
  parseBusinessHours,
  toJstDate,
  isOverlapping,
  isValidUUID,
  isValidDate,
  isValidTime,
  getStoreSettings,
  getWorkingStaffForTimeSlot,
  extractStaffFromGoogleEvent,
  analyzeGoogleEventsForStaff,
  type BusinessHourSlot,
  type StaffInfo,
} from './utils.ts'
import { getGoogleCalendarClient, listGoogleEvents, deleteGoogleEvent } from './google-calendar.ts'

export type BookingParams = {
  store_id?: string
  line_user_id?: string
  date?: string
  staff_id?: string
  menu_id?: string
}

export async function handleGetAvailableSlots(
  supabaseClient: SupabaseClientType,
  params: BookingParams,
  corsHeaders: CorsHeaders
): Promise<Response> {
  const { store_id, date, line_user_id, staff_id, menu_id } = params

  if (!store_id || !date) throw new Error('store_id and date are required')
  if (!isValidUUID(store_id)) throw new Error('Invalid store_id format')
  if (!isValidDate(date)) throw new Error('Invalid date format (expected YYYY-MM-DD)')
  if (staff_id && !isValidUUID(staff_id)) throw new Error('Invalid staff_id format')
  if (menu_id && !isValidUUID(menu_id)) throw new Error('Invalid menu_id format')

  // Cleanup expired holds
  const { data: expiredHolds } = await supabaseClient
    .from('temporary_holds')
    .select('id, google_event_id, store_id')
    .lt('expires_at', new Date().toISOString())

  if (expiredHolds && expiredHolds.length > 0) {
    console.log(`[Booking] Found ${expiredHolds.length} expired holds to cleanup`)
    for (const hold of expiredHolds) {
      if (hold.google_event_id) {
        const googleClient = await getGoogleCalendarClient(supabaseClient, hold.store_id)
        if (googleClient) {
          try {
            await deleteGoogleEvent(googleClient, hold.google_event_id)
            console.log(`[Booking] Deleted expired Google event: ${hold.google_event_id}`)
          } catch (e) {
            console.error('Failed to delete expired Google event:', e)
          }
        }
      }
    }
    await supabaseClient
      .from('temporary_holds')
      .delete()
      .lt('expires_at', new Date().toISOString())
    console.log('[Booking] Cleanup completed')
  }

  const storeSettings = await getStoreSettings(supabaseClient, store_id)
  const slotInterval = storeSettings?.slot_interval_minutes ?? 60

  const { data: specialDate } = await supabaseClient
    .from('booking_special_dates')
    .select('is_closed, override_hours')
    .eq('store_id', store_id)
    .eq('date', date)
    .maybeSingle()

  if (specialDate?.is_closed) {
    return new Response(JSON.stringify({ slots: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let durationMinutes = slotInterval
  let menuCapacity: number | null = null
  if (menu_id) {
    const { data: menu } = await supabaseClient
      .from('booking_menus')
      .select('duration_minutes, capacity_per_slot')
      .eq('id', menu_id)
      .maybeSingle()
    if (menu?.duration_minutes) durationMinutes = menu.duration_minutes
    if (typeof menu?.capacity_per_slot === 'number') menuCapacity = menu.capacity_per_slot
  }

  if (!durationMinutes || durationMinutes <= 0) {
    durationMinutes = slotInterval || 60
  }

  const dayStart = toJstDate(date, '00:00').toISOString()
  const nextDay = new Date(toJstDate(date, '00:00').getTime() + 24 * 60 * 60 * 1000)
  const dayEnd = nextDay.toISOString()

  const { data: staffList } = await supabaseClient
    .from('staff_members')
    .select('id, name')
    .eq('store_id', store_id)
    .eq('is_active', true)

  const staffInfoList: StaffInfo[] = staffList || []

  let query = supabaseClient
    .from('reservations')
    .select('start_time, end_time, status, line_user_id, staff_id')
    .eq('store_id', store_id)
    .neq('status', 'cancelled')
    .lt('start_time', dayEnd)
    .gt('end_time', dayStart)

  if (staff_id) {
    query = query.eq('staff_id', staff_id)
  }

  const { data: reservations, error } = await query
  if (error) throw error

  let holdQuery = supabaseClient
    .from('temporary_holds')
    .select('start_time, end_time, line_user_id, staff_id')
    .eq('store_id', store_id)
    .gt('expires_at', new Date().toISOString())
    .lt('start_time', dayEnd)
    .gt('end_time', dayStart)

  if (staff_id) {
    holdQuery = holdQuery.eq('staff_id', staff_id)
  }

  const { data: holds } = await holdQuery

  const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
  let googleEvents: { start: { dateTime?: string }; end: { dateTime?: string } }[] = []
  if (googleClient) {
    googleEvents = await listGoogleEvents(googleClient, dayStart, dayEnd)
  }

  let effectiveHours: BusinessHourSlot[] = []

  if (staff_id) {
    const targetDate = new Date(`${date}T00:00:00`)
    const dayOfWeek = targetDate.getDay()

    const { data: workPattern } = await supabaseClient
      .from('staff_work_patterns')
      .select('start_time, end_time, is_active')
      .eq('staff_id', staff_id)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle()

    console.log(`[Booking] Staff ${staff_id} work pattern for day ${dayOfWeek}:`, workPattern)

    const { data: specialSchedule } = await supabaseClient
      .from('staff_special_schedules')
      .select('is_absent, override_start, override_end')
      .eq('staff_id', staff_id)
      .eq('date', date)
      .maybeSingle()

    console.log(`[Booking] Staff ${staff_id} special schedule for ${date}:`, specialSchedule)

    if (specialSchedule) {
      if (specialSchedule.is_absent) {
        console.log(`[Booking] Staff ${staff_id} is absent on ${date}`)
        effectiveHours = []
      } else if (specialSchedule.override_start && specialSchedule.override_end) {
        effectiveHours = [{ start: specialSchedule.override_start, end: specialSchedule.override_end }]
      } else {
        if (workPattern?.is_active && workPattern.start_time && workPattern.end_time) {
          effectiveHours = [{ start: workPattern.start_time, end: workPattern.end_time }]
        } else {
          effectiveHours = []
        }
      }
    } else if (workPattern?.is_active) {
      if (workPattern.start_time && workPattern.end_time) {
        effectiveHours = [{ start: workPattern.start_time, end: workPattern.end_time }]
      } else {
        effectiveHours = []
      }
    }

    console.log(`[Booking] Staff ${staff_id} effective hours:`, effectiveHours)

    if (effectiveHours.length === 0) {
      console.log(`[Booking] No available slots for staff ${staff_id} on ${date}`)
      return new Response(JSON.stringify({ slots: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } else {
    if (specialDate?.override_hours && Array.isArray(specialDate.override_hours) && specialDate.override_hours.length > 0) {
      effectiveHours = specialDate.override_hours
    } else if (storeSettings?.business_hours) {
      effectiveHours = parseBusinessHours(storeSettings.business_hours, date)
    } else {
      effectiveHours = [{ start: '10:00', end: '20:00' }]
    }
  }

  const slots: { time: string; available: boolean }[] = []

  for (const hourRange of effectiveHours) {
    const rangeStart = toJstDate(date, hourRange.start)
    const rangeEnd = toJstDate(date, hourRange.end)

    for (let cursor = new Date(rangeStart); cursor < rangeEnd; cursor = new Date(cursor.getTime() + slotInterval * 60000)) {
      const slotEnd = new Date(cursor.getTime() + durationMinutes * 60000)
      if (slotEnd > rangeEnd) continue

      const hh = cursor.getHours().toString().padStart(2, '0')
      const mm = cursor.getMinutes().toString().padStart(2, '0')

      const internalOverlapCount = (reservations || []).filter((r: { status: string; line_user_id: string; start_time: string; end_time: string }) => {
        if (r.status === 'temporary' && r.line_user_id === line_user_id) return false
        const resStart = new Date(r.start_time)
        const resEnd = new Date(r.end_time)
        return isOverlapping(cursor, slotEnd, resStart, resEnd)
      }).length

      const holdOverlapCount = (holds || []).filter((h: { line_user_id: string; start_time: string; end_time: string }) => {
        if (h.line_user_id === line_user_id) return false
        const holdStart = new Date(h.start_time)
        const holdEnd = new Date(h.end_time)
        return isOverlapping(cursor, slotEnd, holdStart, holdEnd)
      }).length

      type GoogleEvent = { start?: { dateTime?: string }; end?: { dateTime?: string }; summary?: string; description?: string }

      const relevantGoogleEvents = googleEvents.filter((e: GoogleEvent) => {
        if (!e.start?.dateTime || !e.end?.dateTime) return false
        if (line_user_id && e.summary?.startsWith('【仮予約】')) {
          if (e.description && e.description.includes(line_user_id)) {
            console.log(`[Booking] Excluding own temporary event: ${e.summary}`)
            return false
          }
        }
        const resStart = new Date(e.start.dateTime)
        const resEnd = new Date(e.end.dateTime)
        return isOverlapping(cursor, slotEnd, resStart, resEnd)
      })

      let capacityLimit: number
      let totalOverlap: number

      if (staff_id) {
        capacityLimit = 1
        const staffReservationCount = internalOverlapCount
        const staffHoldCount = holdOverlapCount
        const staffInfo = staffInfoList.find(s => s.id === staff_id)
        const staffGoogleEvents = staffInfo
          ? relevantGoogleEvents.filter(e => {
              const foundStaff = extractStaffFromGoogleEvent(e, [staffInfo])
              return foundStaff !== null
            })
          : []
        totalOverlap = staffReservationCount + staffHoldCount + staffGoogleEvents.length
      } else {
        const workingStaff = await getWorkingStaffForTimeSlot(
          supabaseClient,
          store_id,
          date,
          cursor,
          slotEnd
        )

        if (workingStaff.length === 0) {
          slots.push({ time: `${hh}:${mm}`, available: false })
          continue
        }

        const internalBookedStaffIds = (reservations || [])
          .filter((r: { status: string; line_user_id: string; start_time: string; end_time: string; staff_id?: string }) => {
            if (r.status === 'temporary' && r.line_user_id === line_user_id) return false
            const resStart = new Date(r.start_time)
            const resEnd = new Date(r.end_time)
            return isOverlapping(cursor, slotEnd, resStart, resEnd) && r.staff_id
          })
          .map((r: { staff_id?: string }) => r.staff_id)
          .filter(Boolean) as string[]

        const holdBookedStaffIds = (holds || [])
          .filter((h: { line_user_id: string; start_time: string; end_time: string; staff_id?: string }) => {
            if (h.line_user_id === line_user_id) return false
            const holdStart = new Date(h.start_time)
            const holdEnd = new Date(h.end_time)
            return isOverlapping(cursor, slotEnd, holdStart, holdEnd) && h.staff_id
          })
          .map((h: { staff_id?: string }) => h.staff_id)
          .filter(Boolean) as string[]

        const { identifiedStaffIds, unknownEventCount } = analyzeGoogleEventsForStaff(
          relevantGoogleEvents,
          staffInfoList,
          cursor,
          slotEnd
        )

        const bookedStaffSet = new Set([...internalBookedStaffIds, ...holdBookedStaffIds, ...identifiedStaffIds])
        const availableStaffCount = workingStaff.length - bookedStaffSet.size - unknownEventCount
        capacityLimit = Math.max(0, availableStaffCount)
        totalOverlap = 0
      }

      const available = totalOverlap < capacityLimit
      slots.push({ time: `${hh}:${mm}`, available })
    }
  }

  return new Response(JSON.stringify({ slots }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
