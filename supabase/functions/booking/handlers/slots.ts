import type { SupabaseClientType } from '../../_shared/types.ts'
import { ClientVisibleError, toErrorMessage } from '../../_shared/error-utils.ts'
import type { CorsHeaders } from './types.ts'
import {
  parseBusinessHours,
  toJstDate,
  formatTimeInJst,
  getJstDayOfWeek,
  resolveStaffEffectiveHours,
  loadModifyExcludeContext,
  reservationBlocksOverlap,
  isExcludedGoogleEventForModify,
  type ModifyExcludeContext,
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

/** デプロイ確認用。ソース更新時に ISO 文字列を更新する */
export const SLOTS_API_VERSION = '2026-05-21T11:00:00Z'

export type BookingParams = {
  store_id?: string
  line_user_id?: string
  date?: string
  staff_id?: string
  menu_id?: string
  /** 予約変更時: この予約は重複判定から除外する */
  reservation_id?: string
}

type ReservationSlotRow = {
  id: string
  status: string
  line_user_id: string
  start_time: string
  end_time: string
  staff_id?: string | null
}

type GoogleEventRow = {
  id?: string
  start?: { dateTime?: string }
  end?: { dateTime?: string }
  summary?: string
  description?: string
}

type BlockedSlotDebug = { time: string; reasons: string[] }

function shouldCountReservationForOverlap(
  r: ReservationSlotRow,
  lineUserId: string | undefined,
  modifyExclude?: ModifyExcludeContext
): boolean {
  if (modifyExclude && r.id === modifyExclude.reservationId) return false
  if (r.status === 'temporary' && lineUserId && r.line_user_id === lineUserId) return false
  return true
}

function formatGoogleEventLabel(e: GoogleEventRow): string {
  const summary = e.summary ?? '(no title)'
  const start = e.start?.dateTime ? formatTimeInJst(new Date(e.start.dateTime)) : '?'
  const end = e.end?.dateTime ? formatTimeInJst(new Date(e.end.dateTime)) : '?'
  return `${summary} (${start}-${end})`
}

function addBlockedReason(blocked: BlockedSlotDebug[], time: string, reason: string): void {
  const entry = blocked.find((b) => b.time === time)
  if (entry) {
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason)
  } else {
    blocked.push({ time, reasons: [reason] })
  }
}

async function purgeOwnHoldsInModifyMode(
  supabaseClient: SupabaseClientType,
  store_id: string,
  line_user_id: string
): Promise<number> {
  const { data: ownHolds } = await supabaseClient
    .from('temporary_holds')
    .select('id, google_event_id')
    .eq('store_id', store_id)
    .eq('line_user_id', line_user_id)

  if (!ownHolds || ownHolds.length === 0) return 0

  const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
  for (const hold of ownHolds) {
    if (hold.google_event_id && googleClient) {
      try {
        await deleteGoogleEvent(googleClient, hold.google_event_id)
        console.log(`[Booking] Modify mode: deleted own hold Google event ${hold.google_event_id}`)
      } catch (e) {
        console.error('Failed to delete own hold Google event:', e)
      }
    }
  }

  await supabaseClient
    .from('temporary_holds')
    .delete()
    .eq('store_id', store_id)
    .eq('line_user_id', line_user_id)

  console.log(`[Booking] Modify mode: purged ${ownHolds.length} own temporary_holds`)
  return ownHolds.length
}

export async function handleGetAvailableSlots(
  supabaseClient: SupabaseClientType,
  params: BookingParams,
  corsHeaders: CorsHeaders
): Promise<Response> {
  const { store_id, date, line_user_id, menu_id, reservation_id } = params
  let { staff_id } = params

  if (!store_id || !date) throw new ClientVisibleError('store_id and date are required')
  if (!isValidUUID(store_id)) throw new ClientVisibleError('Invalid store_id format')
  if (!isValidDate(date)) throw new ClientVisibleError('Invalid date format (expected YYYY-MM-DD)')
  if (staff_id && !isValidUUID(staff_id)) throw new ClientVisibleError('Invalid staff_id format')
  if (menu_id && !isValidUUID(menu_id)) throw new ClientVisibleError('Invalid menu_id format')
  if (reservation_id && !isValidUUID(reservation_id)) {
    throw new ClientVisibleError('Invalid reservation_id format')
  }

  let modifyExclude: ModifyExcludeContext | undefined
  const isModifyMode = Boolean(reservation_id)
  let purgedOwnHolds = 0

  if (reservation_id) {
    modifyExclude = await loadModifyExcludeContext(supabaseClient, store_id, reservation_id)
    if (!staff_id && modifyExclude.staffId) {
      staff_id = modifyExclude.staffId
    }
    if (line_user_id) {
      purgedOwnHolds = await purgeOwnHoldsInModifyMode(supabaseClient, store_id, line_user_id)
    }
    console.log(
      `[Booking] Modify mode: exclude reservation ${modifyExclude.reservationId} (staff=${staff_id}, google=${modifyExclude.googleEventId ?? 'none'}, purgedHolds=${purgedOwnHolds})`
    )
  }

  const excludeReservationId = modifyExclude?.reservationId
  const includeDebug = isModifyMode

  // Cleanup expired holds
  const { data: expiredHolds } = await supabaseClient
    .from('temporary_holds')
    .select('id, google_event_id, store_id')
    .lt('expires_at', new Date().toISOString())

  if (expiredHolds && expiredHolds.length > 0) {
    console.log(`[Booking] Found ${expiredHolds.length} expired holds to cleanup`)
    for (const hold of expiredHolds) {
      if (hold.google_event_id) {
        const gc = await getGoogleCalendarClient(supabaseClient, hold.store_id)
        if (gc) {
          try {
            await deleteGoogleEvent(gc, hold.google_event_id)
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
    return new Response(JSON.stringify({
      version: SLOTS_API_VERSION,
      slots: [],
      ...(includeDebug ? { _debug: { received: { reservation_id, staff_id, line_user_id, date }, closed: true } } : {}),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let durationMinutes = slotInterval
  if (menu_id) {
    const { data: menu } = await supabaseClient
      .from('booking_menus')
      .select('duration_minutes, capacity_per_slot')
      .eq('id', menu_id)
      .maybeSingle()
    if (menu?.duration_minutes) durationMinutes = menu.duration_minutes
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
    .select('id, start_time, end_time, status, line_user_id, staff_id')
    .eq('store_id', store_id)
    .neq('status', 'cancelled')
    .lt('start_time', dayEnd)
    .gt('end_time', dayStart)

  if (staff_id) {
    query = query.eq('staff_id', staff_id)
  }

  if (excludeReservationId) {
    query = query.neq('id', excludeReservationId)
  }

  const { data: reservations, error } = await query
  if (error) throw new ClientVisibleError(toErrorMessage(error))

  const blockingReservations = (reservations ?? []).filter(
    (r) => !excludeReservationId || r.id !== excludeReservationId
  )

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
  let googleEvents: GoogleEventRow[] = []
  if (googleClient) {
    googleEvents = await listGoogleEvents(googleClient, dayStart, dayEnd)
  }

  let effectiveHours: BusinessHourSlot[] = []

  if (staff_id) {
    const dayOfWeek = getJstDayOfWeek(date)

    const { data: workPattern } = await supabaseClient
      .from('staff_work_patterns')
      .select('start_time, end_time, slots, is_active')
      .eq('staff_id', staff_id)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle()

    const { data: specialSchedule } = await supabaseClient
      .from('staff_special_schedules')
      .select('is_absent, override_start, override_end')
      .eq('staff_id', staff_id)
      .eq('date', date)
      .maybeSingle()

    effectiveHours = resolveStaffEffectiveHours(workPattern, specialSchedule)

    if (effectiveHours.length === 0) {
      return new Response(JSON.stringify({
        version: SLOTS_API_VERSION,
        slots: [],
        ...(includeDebug ? {
          _debug: {
            received: { reservation_id, staff_id, line_user_id, date, menu_duration: durationMinutes },
            modifyExclude,
            noWorkingHours: true,
          },
        } : {}),
      }), {
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
  const blocked: BlockedSlotDebug[] = []

  for (const hourRange of effectiveHours) {
    const rangeStart = toJstDate(date, hourRange.start)
    const rangeEnd = toJstDate(date, hourRange.end)

    for (let cursor = new Date(rangeStart); cursor < rangeEnd; cursor = new Date(cursor.getTime() + slotInterval * 60000)) {
      const slotEnd = new Date(cursor.getTime() + durationMinutes * 60000)
      if (slotEnd > rangeEnd) {
        if (includeDebug) {
          addBlockedReason(blocked, formatTimeInJst(cursor), `working_hours:slot_end_${formatTimeInJst(slotEnd)}_exceeds_${hourRange.end}`)
        }
        continue
      }

      const hhmm = formatTimeInJst(cursor)
      const slotReasons: string[] = []

      const overlappingReservations = blockingReservations.filter((r: ReservationSlotRow) => {
        if (!shouldCountReservationForOverlap(r, line_user_id, modifyExclude)) return false
        return reservationBlocksOverlap(r, cursor, slotEnd, modifyExclude, line_user_id)
      })

      for (const r of overlappingReservations) {
        slotReasons.push(`reservation:${r.id}:${formatTimeInJst(new Date(r.start_time))}-${formatTimeInJst(new Date(r.end_time))}`)
      }

      const overlappingHolds = (holds || []).filter((h: { line_user_id: string; start_time: string; end_time: string; staff_id?: string | null }) => {
        if (isModifyMode && line_user_id && h.line_user_id === line_user_id) return false
        if (h.line_user_id === line_user_id) return false
        const holdStart = new Date(h.start_time)
        const holdEnd = new Date(h.end_time)
        return isOverlapping(cursor, slotEnd, holdStart, holdEnd)
      })

      for (const h of overlappingHolds) {
        slotReasons.push(`hold:${h.line_user_id}:${formatTimeInJst(new Date(h.start_time))}-${formatTimeInJst(new Date(h.end_time))}`)
      }

      const relevantGoogleEvents = googleEvents.filter((e: GoogleEventRow) => {
        if (!e.start?.dateTime || !e.end?.dateTime) return false
        if (isExcludedGoogleEventForModify(e, line_user_id, modifyExclude)) return false
        const resStart = new Date(e.start.dateTime)
        const resEnd = new Date(e.end.dateTime)
        return isOverlapping(cursor, slotEnd, resStart, resEnd)
      })

      let capacityLimit: number
      let totalOverlap: number

      if (staff_id) {
        capacityLimit = 1
        const staffInfo = staffInfoList.find(s => s.id === staff_id)
        const staffGoogleEvents = staffInfo
          ? relevantGoogleEvents.filter(e => extractStaffFromGoogleEvent(e, [staffInfo]) !== null)
          : []

        for (const e of staffGoogleEvents) {
          slotReasons.push(`google:${formatGoogleEventLabel(e)}`)
        }

        // スタッフ未特定の Google イベントも staff_id モードではブロックしない（extractStaff ベース）
        totalOverlap = overlappingReservations.length + overlappingHolds.length + staffGoogleEvents.length
      } else if (staffInfoList.length === 0 || storeSettings.booking_enable_staff !== true) {
        capacityLimit = storeSettings?.capacity_per_slot ?? 10

        const nullStaffReservations = blockingReservations.filter((r: ReservationSlotRow) => {
          if (!shouldCountReservationForOverlap(r, line_user_id, modifyExclude)) return false
          if (r.staff_id) return false
          return reservationBlocksOverlap(r, cursor, slotEnd, modifyExclude, line_user_id)
        })

        slotReasons.length = 0
        for (const r of nullStaffReservations) {
          slotReasons.push(`reservation:${r.id}:${formatTimeInJst(new Date(r.start_time))}-${formatTimeInJst(new Date(r.end_time))}`)
        }

        const nullStaffHolds = (holds || []).filter((h: { line_user_id: string; start_time: string; end_time: string; staff_id?: string | null }) => {
          if (h.line_user_id === line_user_id) return false
          if (h.staff_id) return false
          const holdStart = new Date(h.start_time)
          const holdEnd = new Date(h.end_time)
          return isOverlapping(cursor, slotEnd, holdStart, holdEnd)
        })

        for (const h of nullStaffHolds) {
          slotReasons.push(`hold:${h.line_user_id}`)
        }

        totalOverlap = nullStaffReservations.length + nullStaffHolds.length
      } else {
        const workingStaff = await getWorkingStaffForTimeSlot(
          supabaseClient,
          store_id,
          date,
          cursor,
          slotEnd
        )

        if (workingStaff.length === 0) {
          if (includeDebug) addBlockedReason(blocked, hhmm, 'working_hours:no_staff_on_shift')
          slots.push({ time: hhmm, available: false })
          continue
        }

        const internalBookedStaffIds = blockingReservations
          .filter((r: ReservationSlotRow) => {
            if (!shouldCountReservationForOverlap(r, line_user_id, modifyExclude)) return false
            return reservationBlocksOverlap(r, cursor, slotEnd, modifyExclude, line_user_id) && r.staff_id
          })
          .map((r: { staff_id?: string }) => r.staff_id)
          .filter(Boolean) as string[]

        const holdBookedStaffIds = (holds || [])
          .filter((h: { line_user_id: string; start_time: string; end_time: string; staff_id?: string }) => {
            if (isModifyMode && line_user_id && h.line_user_id === line_user_id) return false
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

        for (const staffId of internalBookedStaffIds) {
          const name = staffInfoList.find(s => s.id === staffId)?.name ?? staffId
          slotReasons.push(`reservation:staff:${name}`)
        }
        for (const staffId of holdBookedStaffIds) {
          const name = staffInfoList.find(s => s.id === staffId)?.name ?? staffId
          slotReasons.push(`hold:staff:${name}`)
        }
        for (const e of relevantGoogleEvents) {
          const staff = extractStaffFromGoogleEvent(e, staffInfoList)
          if (staff) slotReasons.push(`google:staff:${staff.name}:${formatGoogleEventLabel(e)}`)
        }
        if (unknownEventCount > 0) {
          slotReasons.push(`google:unknown:${unknownEventCount}`)
        }

        const bookedStaffSet = new Set([...internalBookedStaffIds, ...holdBookedStaffIds, ...identifiedStaffIds])
        const availableStaffCount = workingStaff.length - bookedStaffSet.size - unknownEventCount
        capacityLimit = Math.max(0, availableStaffCount)
        totalOverlap = 0

        if (availableStaffCount <= 0 && slotReasons.length === 0) {
          slotReasons.push('capacity:all_staff_busy')
        }
      }

      const available = totalOverlap < capacityLimit
      slots.push({ time: hhmm, available })

      if (includeDebug && !available) {
        if (slotReasons.length > 0) {
          for (const reason of slotReasons) {
            addBlockedReason(blocked, hhmm, reason)
          }
        } else if (totalOverlap >= capacityLimit) {
          addBlockedReason(blocked, hhmm, `capacity:overlap_${totalOverlap}_limit_${capacityLimit}`)
        }
      }
    }
  }

  const responseBody: Record<string, unknown> = {
    version: SLOTS_API_VERSION,
    slots,
  }

  if (includeDebug) {
    responseBody._debug = {
      received: {
        reservation_id: reservation_id ?? null,
        staff_id: staff_id ?? null,
        line_user_id: line_user_id ?? null,
        date,
        menu_id: menu_id ?? null,
        menu_duration: durationMinutes,
      },
      modifyExclude: modifyExclude ?? null,
      purgedOwnHolds,
      blockingReservationCount: blockingReservations.length,
      googleEventCount: googleEvents.length,
      blocked,
    }
  }

  return new Response(JSON.stringify(responseBody), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
