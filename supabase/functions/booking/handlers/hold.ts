import type { SupabaseClientType } from '../../_shared/types.ts'
import { ClientVisibleError, toErrorMessage } from '../../_shared/error-utils.ts'
import type { CorsHeaders } from './types.ts'
import {
  isValidUUID,
  isValidDate,
  isValidTime,
  isPastDate,
  isWithinMaxBookingDays,
  isOverlapping,
  loadModifyExcludeContext,
  isExcludedGoogleEventForModify,
  extractStaffFromGoogleEvent,
  type ModifyExcludeContext,
  getStoreSettings,
  getWorkingStaffForTimeSlot,
} from './utils.ts'
import { getGoogleCalendarClient, createGoogleEvent, deleteGoogleEvent, listGoogleEvents } from './google-calendar.ts'

export type HoldParams = {
  store_id?: string
  line_user_id?: string
  date?: string
  time?: string
  staff_id?: string
  menu_id?: string
  display_name?: string
  /** 予約変更時: この予約は重複判定から除外する */
  reservation_id?: string
}

export async function handleHoldSlot(
  supabaseClient: SupabaseClientType,
  params: HoldParams,
  corsHeaders: CorsHeaders
): Promise<Response> {
  const { store_id, line_user_id: requestLineUserId, date, time, menu_id, display_name, reservation_id } = params
  let { staff_id } = params
  let line_user_id = requestLineUserId

  if (!store_id || !date || !time) throw new ClientVisibleError('store_id, date, and time are required')
  if (!isValidUUID(store_id)) throw new ClientVisibleError('Invalid store_id format')
  if (!isValidDate(date)) throw new ClientVisibleError('Invalid date format (expected YYYY-MM-DD)')
  if (!isValidTime(time)) throw new ClientVisibleError('Invalid time format (expected HH:MM)')
  if (staff_id && !isValidUUID(staff_id)) throw new ClientVisibleError('Invalid staff_id format')
  if (menu_id && !isValidUUID(menu_id)) throw new ClientVisibleError('Invalid menu_id format')
  if (reservation_id && !isValidUUID(reservation_id)) {
    throw new ClientVisibleError('Invalid reservation_id format')
  }

  let modifyExclude: ModifyExcludeContext | undefined
  const isModifyMode = Boolean(reservation_id)

  if (reservation_id) {
    modifyExclude = await loadModifyExcludeContext(supabaseClient, store_id, reservation_id)
    // 予約所有者の LINE ID を使用（LIFF / Messaging API の ID ゆれ対策）
    line_user_id = modifyExclude.lineUserId
    if (modifyExclude.staffId) {
      staff_id = modifyExclude.staffId
    }

    const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
    const { data: ownHolds } = await supabaseClient
      .from('temporary_holds')
      .select('id, google_event_id')
      .eq('store_id', store_id)
      .eq('line_user_id', line_user_id)

    if (ownHolds && ownHolds.length > 0) {
      if (googleClient) {
        for (const hold of ownHolds) {
          if (hold.google_event_id) {
            try {
              await deleteGoogleEvent(googleClient, hold.google_event_id)
            } catch (e) {
              console.error('Failed to delete own hold Google event in modify mode:', e)
            }
          }
        }
      }
      await supabaseClient
        .from('temporary_holds')
        .delete()
        .eq('store_id', store_id)
        .eq('line_user_id', line_user_id)
    }
  }

  const excludeReservationId = modifyExclude?.reservationId

  const storeSettings = await getStoreSettings(supabaseClient, store_id)
  if (isPastDate(date, time)) throw new ClientVisibleError('過去の日付は予約できません')
  const maxDays = storeSettings?.max_booking_days ?? 60
  if (!isWithinMaxBookingDays(date, maxDays)) {
    throw new ClientVisibleError(`予約可能日は${maxDays}日後までです`)
  }

  let durationMinutes = storeSettings?.slot_interval_minutes ?? 60

  if (menu_id) {
    const { data: menu } = await supabaseClient
      .from('booking_menus')
      .select('duration_minutes, capacity_per_slot')
      .eq('id', menu_id)
      .maybeSingle()
    if (menu?.duration_minutes) durationMinutes = menu.duration_minutes
  }
  if (!durationMinutes || durationMinutes <= 0) durationMinutes = storeSettings?.slot_interval_minutes ?? 60

  const startDateTime = new Date(`${date}T${time}:00+09:00`)
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000)

  // 容量チェック: 予約枠に空きがあるか確認
  if (staff_id) {
    let overlapQuery = supabaseClient
      .from('reservations')
      .select('id')
      .eq('store_id', store_id)
      .eq('staff_id', staff_id)
      .neq('status', 'cancelled')
      .neq('status', 'temporary')
      .lt('start_time', endDateTime.toISOString())
      .gt('end_time', startDateTime.toISOString())
    if (excludeReservationId) {
      overlapQuery = overlapQuery.neq('id', excludeReservationId)
    }
    const { data: overlapReservations } = await overlapQuery

    const { data: conflictingHolds } = await supabaseClient
      .from('temporary_holds')
      .select('id, line_user_id')
      .eq('store_id', store_id)
      .eq('staff_id', staff_id)
      .gt('expires_at', new Date().toISOString())
      .lt('start_time', endDateTime.toISOString())
      .gt('end_time', startDateTime.toISOString())

    const otherHoldCount = (conflictingHolds || []).filter(h => h.line_user_id !== line_user_id).length

    let googleConflictCount = 0
    const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
    if (googleClient) {
      const { data: staffInfo } = await supabaseClient
        .from('staff_members')
        .select('id, name')
        .eq('id', staff_id)
        .maybeSingle()

      if (staffInfo) {
        const googleEvents = await listGoogleEvents(
          googleClient,
          startDateTime.toISOString(),
          endDateTime.toISOString()
        )
        googleConflictCount = googleEvents.filter((e: {
          id?: string
          start?: { dateTime?: string }
          end?: { dateTime?: string }
          summary?: string
          description?: string
        }) => {
          if (!e.start?.dateTime || !e.end?.dateTime) return false
          if (isExcludedGoogleEventForModify(e, line_user_id, modifyExclude)) return false
          const eventStart = new Date(e.start.dateTime)
          const eventEnd = new Date(e.end.dateTime)
          if (!isOverlapping(startDateTime, endDateTime, eventStart, eventEnd)) return false
          return extractStaffFromGoogleEvent(e, [staffInfo]) !== null
        }).length
      }
    }

    if ((overlapReservations?.length ?? 0) + otherHoldCount + googleConflictCount >= 1) {
      throw new ClientVisibleError('この時間帯の予約枠が埋まっています')
    }
  } else {
    const { data: activeStaffMembers } = await supabaseClient
      .from('staff_members')
      .select('id')
      .eq('store_id', store_id)
      .eq('is_active', true)
      .limit(1)

    const hasNoStaffRegistered = !activeStaffMembers || activeStaffMembers.length === 0
    const useStoreCapacityUnassigned =
      hasNoStaffRegistered || storeSettings.booking_enable_staff !== true

    if (useStoreCapacityUnassigned) {
      const capacityLimit = storeSettings?.capacity_per_slot ?? 10

      let storeOverlapQuery = supabaseClient
        .from('reservations')
        .select('id')
        .eq('store_id', store_id)
        .is('staff_id', null)
        .neq('status', 'cancelled')
        .neq('status', 'temporary')
        .lt('start_time', endDateTime.toISOString())
        .gt('end_time', startDateTime.toISOString())
      if (excludeReservationId) {
        storeOverlapQuery = storeOverlapQuery.neq('id', excludeReservationId)
      }
      const { data: overlapReservations } = await storeOverlapQuery

      const { data: conflictingHolds } = await supabaseClient
        .from('temporary_holds')
        .select('id, line_user_id')
        .eq('store_id', store_id)
        .is('staff_id', null)
        .gt('expires_at', new Date().toISOString())
        .lt('start_time', endDateTime.toISOString())
        .gt('end_time', startDateTime.toISOString())

      const otherHoldCount = (conflictingHolds || []).filter(h => h.line_user_id !== line_user_id).length
      if ((overlapReservations?.length ?? 0) + otherHoldCount >= capacityLimit) {
        throw new ClientVisibleError('この時間帯の予約枠が埋まっています')
      }
    } else {
      const workingStaff = await getWorkingStaffForTimeSlot(supabaseClient, store_id, date!, startDateTime, endDateTime)
      if (workingStaff.length === 0) {
        throw new ClientVisibleError('この時間帯に対応可能なスタッフがいません')
      }

      let staffOverlapQuery = supabaseClient
        .from('reservations')
        .select('staff_id')
        .eq('store_id', store_id)
        .neq('status', 'cancelled')
        .neq('status', 'temporary')
        .lt('start_time', endDateTime.toISOString())
        .gt('end_time', startDateTime.toISOString())
      if (excludeReservationId) {
        staffOverlapQuery = staffOverlapQuery.neq('id', excludeReservationId)
      }
      const { data: overlapReservations } = await staffOverlapQuery

      const bookedStaffIds = (overlapReservations || [])
        .map((r: { staff_id?: string }) => r.staff_id)
        .filter(Boolean) as string[]

      const { data: conflictingHolds } = await supabaseClient
        .from('temporary_holds')
        .select('staff_id, line_user_id')
        .eq('store_id', store_id)
        .gt('expires_at', new Date().toISOString())
        .lt('start_time', endDateTime.toISOString())
        .gt('end_time', startDateTime.toISOString())

      const holdBookedStaffIds = (conflictingHolds || [])
        .filter((h: { line_user_id?: string }) => h.line_user_id !== line_user_id)
        .map((h: { staff_id?: string }) => h.staff_id)
        .filter(Boolean) as string[]

      const bookedStaffSet = new Set([...bookedStaffIds, ...holdBookedStaffIds])
      const availableStaffCount = workingStaff.length - bookedStaffSet.size
      if (availableStaffCount <= 0) {
        throw new ClientVisibleError('この時間帯の予約枠が埋まっています')
      }
    }
  }

  const { data: existingHolds } = await supabaseClient
    .from('temporary_holds')
    .select('google_event_id')
    .eq('line_user_id', line_user_id)
    .eq('store_id', store_id)

  const googleClientForHold = await getGoogleCalendarClient(supabaseClient, store_id)
  if (googleClientForHold && existingHolds && existingHolds.length > 0) {
    for (const hold of existingHolds) {
      if (hold.google_event_id) {
        try {
          await deleteGoogleEvent(googleClientForHold, hold.google_event_id)
          console.log(`[Booking] Deleted old temporary Google event: ${hold.google_event_id}`)
        } catch (e) {
          console.error('Failed to delete old temporary Google event:', e)
        }
      }
    }
  }

  await supabaseClient
    .from('temporary_holds')
    .delete()
    .eq('line_user_id', line_user_id)
    .eq('store_id', store_id)

  let googleEventId: string | null = null
  // 予約変更時は Google 仮予約を作らない（旧予約イベントとの重複・カレンダー汚染を避ける）
  if (googleClientForHold && !isModifyMode) {
    try {
      const eventData = {
        summary: '【仮予約】' + (display_name || 'お客様'),
        description: `仮押さえ中\nユーザーID: ${line_user_id}`,
        start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Tokyo' },
        end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Tokyo' },
        colorId: '11',
      }
      googleEventId = await createGoogleEvent(googleClientForHold, eventData)
    } catch (e) {
      console.error('Failed to create temporary Google event:', e)
    }
  }

  const { data: hold, error: holdError } = await supabaseClient
    .from('temporary_holds')
    .insert({
      store_id,
      line_user_id,
      staff_id: staff_id || null,
      menu_id: menu_id || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      google_event_id: googleEventId,
    })
    .select()
    .single()

  if (holdError) throw new ClientVisibleError(toErrorMessage(holdError))

  return new Response(JSON.stringify({ hold_id: hold.id, expires_at: hold.expires_at }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export type ReleaseHoldParams = {
  store_id?: string
  line_user_id?: string
}

export async function handleReleaseHold(
  supabaseClient: SupabaseClientType,
  params: ReleaseHoldParams,
  corsHeaders: CorsHeaders
): Promise<Response> {
  const { store_id, line_user_id } = params
  if (!store_id || !line_user_id) throw new ClientVisibleError('store_id and line_user_id are required')

  const { data: holds } = await supabaseClient
    .from('temporary_holds')
    .select('*')
    .eq('line_user_id', line_user_id)
    .eq('store_id', store_id)

  if (holds && holds.length > 0) {
    const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
    for (const hold of holds) {
      if (hold.google_event_id && googleClient) {
        try {
          await deleteGoogleEvent(googleClient, hold.google_event_id)
        } catch (e) {
          console.error('Failed to delete temporary Google event:', e)
        }
      }
    }
  }

  await supabaseClient
    .from('temporary_holds')
    .delete()
    .eq('line_user_id', line_user_id)
    .eq('store_id', store_id)

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
