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
  getStoreSettings,
  getWorkingStaffForTimeSlot,
  extractStaffFromGoogleEvent,
  analyzeGoogleEventsForStaff,
  type StaffInfo,
} from './utils.ts'
import {
  getGoogleCalendarClient,
  listGoogleEvents,
  createGoogleEvent,
  deleteGoogleEvent,
} from './google-calendar.ts'

type GoogleClientType = { accessToken: string; calendarId: string } | null

async function fetchFirstLineAccountId(
  supabaseClient: SupabaseClientType,
  store_id: string,
): Promise<string | null> {
  const { data, error } = await supabaseClient
    .from('line_accounts')
    .select('id')
    .eq('store_id', store_id)
    .order('id', { ascending: false })
    .limit(1)
  if (error) throw new ClientVisibleError(toErrorMessage(error))
  return data?.[0]?.id ?? null
}

type CreateReservationWithCapacityCheckParams = {
  supabaseClient: SupabaseClientType
  store_id: string
  line_user_id: string
  date: string
  time: string
  staff_id: string | null
  menu_id: string | null
  memo: string
  display_name?: string
  profile_picture_url?: string
  real_name?: string
  furigana?: string
  isManualRegistration: boolean
  excludeReservationId?: string
  preloadedGoogleClient?: GoogleClientType
}

async function createReservationWithCapacityCheck(params: CreateReservationWithCapacityCheckParams): Promise<string> {
  const {
    supabaseClient,
    store_id,
    line_user_id,
    date,
    time,
    staff_id,
    menu_id,
    memo,
    display_name,
    profile_picture_url,
    real_name,
    furigana,
    isManualRegistration,
    excludeReservationId,
    preloadedGoogleClient,
  } = params

  const lineAccountId = await fetchFirstLineAccountId(supabaseClient, store_id)
  if (!lineAccountId && !isManualRegistration) {
    throw new ClientVisibleError('この店舗に LINE アカウントが登録されていません')
  }

  const { error: custError } = await supabaseClient
    .from('customers')
    .upsert({
      store_id,
      line_user_id,
      display_name,
      profile_picture_url,
      real_name,
      furigana,
    }, { onConflict: 'store_id, line_user_id' })

  if (custError) throw new ClientVisibleError(toErrorMessage(custError))

  const startDateTime = new Date(`${date}T${time}:00+09:00`)
  const storeSettings = await getStoreSettings(supabaseClient, store_id)
  let durationMinutes = storeSettings?.slot_interval_minutes ?? 60

  if (menu_id) {
    const { data: menu } = await supabaseClient
      .from('booking_menus')
      .select('duration_minutes')
      .eq('id', menu_id)
      .maybeSingle()
    if (menu?.duration_minutes) durationMinutes = menu.duration_minutes
  }
  if (!durationMinutes || durationMinutes <= 0) durationMinutes = storeSettings?.slot_interval_minutes ?? 60

  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000)

  const googleClient = preloadedGoogleClient !== undefined
    ? preloadedGoogleClient
    : await getGoogleCalendarClient(supabaseClient, store_id)

  if (staff_id) {
    const capacityLimit = 1

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

    const { data: overlapReservations, error: overlapError } = await overlapQuery
    if (overlapError) throw new ClientVisibleError(toErrorMessage(overlapError))

    const { data: conflictingHolds } = await supabaseClient
      .from('temporary_holds')
      .select('id, line_user_id')
      .eq('store_id', store_id)
      .eq('staff_id', staff_id)
      .gt('expires_at', new Date().toISOString())
      .lt('start_time', endDateTime.toISOString())
      .gt('end_time', startDateTime.toISOString())

    const otherUsersHold = (conflictingHolds || []).filter((h: { line_user_id?: string }) => h.line_user_id !== line_user_id)

    let googleConflictCount = 0
    if (googleClient) {
      const { data: staffInfo } = await supabaseClient
        .from('staff_members')
        .select('id, name')
        .eq('id', staff_id)
        .maybeSingle()

      if (staffInfo) {
        const googleEvents = await listGoogleEvents(googleClient, startDateTime.toISOString(), endDateTime.toISOString())
        const staffGoogleEvents = googleEvents.filter((e: { start?: { dateTime?: string }; end?: { dateTime?: string }; summary?: string; description?: string }) => {
          if (!e.start?.dateTime || !e.end?.dateTime) return false
          const eventStart = new Date(e.start.dateTime)
          const eventEnd = new Date(e.end.dateTime)
          if (!isOverlapping(startDateTime, endDateTime, eventStart, eventEnd)) return false

          if (line_user_id && e.summary?.startsWith('【仮予約】')) {
            if (e.description && e.description.includes(line_user_id)) return false
          }

          const foundStaff = extractStaffFromGoogleEvent(e, [staffInfo])
          return foundStaff !== null
        })
        googleConflictCount = staffGoogleEvents.length
      }
    }

    if ((overlapReservations?.length ?? 0) + otherUsersHold.length + googleConflictCount >= capacityLimit) {
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

    if (hasNoStaffRegistered) {
      // create_reservation_atomic と同じ: スタッフ未登録店舗は担当なしで店舗枠 (capacity_per_slot) のみ
      const capacityLimit = storeSettings?.capacity_per_slot ?? 10

      let overlapQuery = supabaseClient
        .from('reservations')
        .select('id')
        .eq('store_id', store_id)
        .is('staff_id', null)
        .neq('status', 'cancelled')
        .neq('status', 'temporary')
        .lt('start_time', endDateTime.toISOString())
        .gt('end_time', startDateTime.toISOString())

      if (excludeReservationId) {
        overlapQuery = overlapQuery.neq('id', excludeReservationId)
      }

      const { data: overlapReservations, error: overlapError } = await overlapQuery
      if (overlapError) throw new ClientVisibleError(toErrorMessage(overlapError))

      const { data: conflictingHolds } = await supabaseClient
        .from('temporary_holds')
        .select('id, line_user_id')
        .eq('store_id', store_id)
        .is('staff_id', null)
        .gt('expires_at', new Date().toISOString())
        .lt('start_time', endDateTime.toISOString())
        .gt('end_time', startDateTime.toISOString())

      const otherUsersHold = (conflictingHolds || []).filter((h: { line_user_id?: string }) => h.line_user_id !== line_user_id)

      if ((overlapReservations?.length ?? 0) + otherUsersHold.length >= capacityLimit) {
        throw new ClientVisibleError('この時間帯の予約枠が埋まっています')
      }
    } else {
      const workingStaff = await getWorkingStaffForTimeSlot(
        supabaseClient,
        store_id,
        date,
        startDateTime,
        endDateTime
      )

      if (workingStaff.length === 0) {
        throw new ClientVisibleError('この時間帯に対応可能なスタッフがいません')
      }

      let overlapQuery = supabaseClient
        .from('reservations')
        .select('staff_id')
        .eq('store_id', store_id)
        .neq('status', 'cancelled')
        .neq('status', 'temporary')
        .lt('start_time', endDateTime.toISOString())
        .gt('end_time', startDateTime.toISOString())

      if (excludeReservationId) {
        overlapQuery = overlapQuery.neq('id', excludeReservationId)
      }

      const { data: overlapReservations, error: overlapError } = await overlapQuery
      if (overlapError) throw new ClientVisibleError(toErrorMessage(overlapError))

      const internalBookedStaffIds = (overlapReservations || [])
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

      const { data: staffList } = await supabaseClient
        .from('staff_members')
        .select('id, name')
        .eq('store_id', store_id)
        .eq('is_active', true)

      let googleBookedStaffIds: string[] = []
      let unknownEventCount = 0

      if (googleClient && staffList) {
        const googleEvents = (await listGoogleEvents(googleClient, startDateTime.toISOString(), endDateTime.toISOString()))
          .filter((e: { summary?: string; description?: string }) => {
            if (line_user_id && e.summary?.startsWith('【仮予約】')) {
              if (e.description && e.description.includes(line_user_id)) return false
            }
            return true
          })

        const { identifiedStaffIds, unknownEventCount: unknown } = analyzeGoogleEventsForStaff(
          googleEvents,
          staffList as StaffInfo[],
          startDateTime,
          endDateTime
        )
        googleBookedStaffIds = identifiedStaffIds
        unknownEventCount = unknown
      }

      const bookedStaffSet = new Set([...internalBookedStaffIds, ...holdBookedStaffIds, ...googleBookedStaffIds])
      const availableStaffCount = workingStaff.length - bookedStaffSet.size - unknownEventCount

      if (availableStaffCount <= 0) {
        throw new ClientVisibleError('この時間帯の予約枠が埋まっています')
      }
    }
  }

  const { data: userHolds } = await supabaseClient
    .from('temporary_holds')
    .select('google_event_id')
    .eq('store_id', store_id)
    .eq('line_user_id', line_user_id)

  if (googleClient && userHolds && userHolds.length > 0) {
    for (const hold of userHolds) {
      if (hold.google_event_id) {
        try {
          await deleteGoogleEvent(googleClient, hold.google_event_id)
          console.log(`[Booking] Deleted temporary Google event: ${hold.google_event_id}`)
        } catch (e) {
          console.error(`[Booking] Failed to delete temporary Google event ${hold.google_event_id}:`, e)
        }
      }
    }
  }

  await supabaseClient
    .from('temporary_holds')
    .delete()
    .eq('store_id', store_id)
    .eq('line_user_id', line_user_id)

  const { data: reservationId, error: rpcError } = await supabaseClient.rpc('create_reservation_atomic', {
    p_store_id: store_id,
    p_line_account_id: lineAccountId,
    p_line_user_id: line_user_id,
    p_start_time: startDateTime.toISOString(),
    p_end_time: endDateTime.toISOString(),
    p_staff_id: staff_id || null,
    p_menu_id: menu_id || null,
    p_memo: memo || '',
    p_registration_type: isManualRegistration ? 'manual' : 'line'
  })

  if (rpcError) {
    throw new ClientVisibleError(rpcError.message || '予約の作成に失敗しました')
  }

  if (!reservationId) {
    throw new ClientVisibleError('予約の作成に失敗しました')
  }

  return reservationId
}

async function createGoogleCalendarEventForReservation(
  supabaseClient: SupabaseClientType,
  reservationId: string,
  store_id: string,
  startDateTime: Date,
  endDateTime: Date,
  staff_id: string | null,
  menu_id: string | null,
  real_name: string | undefined,
  display_name: string | undefined,
  line_user_id: string,
  memo: string,
  preloadedGoogleClient?: GoogleClientType
): Promise<void> {
  const googleClient = preloadedGoogleClient !== undefined
    ? preloadedGoogleClient
    : await getGoogleCalendarClient(supabaseClient, store_id)
  if (!googleClient) return

  try {
    let staffName = '指定なし'
    if (staff_id) {
      const { data: staff } = await supabaseClient
        .from('staff_members')
        .select('name')
        .eq('id', staff_id)
        .maybeSingle()
      if (staff) staffName = staff.name
    }

    let menuName = '指定なし'
    let menuPrice = ''
    if (menu_id) {
      const { data: menu } = await supabaseClient
        .from('booking_menus')
        .select('name, price')
        .eq('id', menu_id)
        .maybeSingle()
      if (menu) {
        menuName = menu.name
        if (menu.price) menuPrice = `(¥${menu.price.toLocaleString()})`
      }
    }

    const summary = `予約: ${real_name || display_name || 'LINE User'} 様`
    const description = `
■予約詳細
------------------
【お名前】 ${real_name || display_name || 'ゲスト'} 様
【担当】 ${staffName}
【メニュー】 ${menuName} ${menuPrice}
【メモ】
${memo || 'なし'}
------------------
LINE ID: ${line_user_id}
`.trim()

    const eventId = await createGoogleEvent(googleClient, {
      summary,
      description,
      start: { dateTime: startDateTime.toISOString() },
      end: { dateTime: endDateTime.toISOString() }
    })

    if (eventId) {
      await supabaseClient
        .from('reservations')
        .update({ google_event_id: eventId })
        .eq('id', reservationId)
    }
  } catch (gError) {
    console.error('Failed to create Google Calendar event:', gError)
  }
}

export type CreateReservationParams = {
  store_id?: string
  line_user_id?: string
  date?: string
  time?: string
  staff_id?: string
  menu_id?: string
  memo?: string
  display_name?: string
  profile_picture_url?: string
  real_name?: string
  furigana?: string
  isManualRegistration: boolean
}

export async function handleCreateReservation(
  supabaseClient: SupabaseClientType,
  params: CreateReservationParams,
  corsHeaders: CorsHeaders
): Promise<Response> {
  const {
    store_id,
    line_user_id,
    date,
    time,
    staff_id,
    menu_id,
    memo,
    display_name,
    profile_picture_url,
    real_name,
    furigana,
    isManualRegistration,
  } = params

  if (!store_id || !date || !time) throw new ClientVisibleError('store_id, date, and time are required')
  if (!isValidUUID(store_id)) throw new ClientVisibleError('Invalid store_id format')
  if (!isValidDate(date)) throw new ClientVisibleError('Invalid date format (expected YYYY-MM-DD)')
  if (!isValidTime(time)) throw new ClientVisibleError('Invalid time format (expected HH:MM)')
  if (staff_id && !isValidUUID(staff_id)) throw new ClientVisibleError('Invalid staff_id format')
  if (menu_id && !isValidUUID(menu_id)) throw new ClientVisibleError('Invalid menu_id format')

  const storeSettings = await getStoreSettings(supabaseClient, store_id)
  if (isPastDate(date, time)) throw new ClientVisibleError('過去の日付は予約できません')
  const maxDays = storeSettings?.max_booking_days ?? 60
  if (!isWithinMaxBookingDays(date, maxDays)) {
    throw new ClientVisibleError(`予約可能日は${maxDays}日後までです`)
  }

  const startDateTime = new Date(`${date}T${time}:00+09:00`)
  let durationMinutes = storeSettings?.slot_interval_minutes ?? 60
  if (menu_id) {
    const { data: menu } = await supabaseClient
      .from('booking_menus')
      .select('duration_minutes')
      .eq('id', menu_id)
      .maybeSingle()
    if (menu?.duration_minutes) durationMinutes = menu.duration_minutes
  }
  if (!durationMinutes || durationMinutes <= 0) durationMinutes = storeSettings?.slot_interval_minutes ?? 60
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000)

  const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)

  const reservationId = await createReservationWithCapacityCheck({
    supabaseClient,
    store_id,
    line_user_id: line_user_id!,
    date,
    time,
    staff_id: staff_id || null,
    menu_id: menu_id || null,
    memo: memo || '',
    display_name,
    profile_picture_url,
    real_name,
    furigana,
    isManualRegistration,
    preloadedGoogleClient: googleClient,
  })

  await supabaseClient
    .from('reservations')
    .delete()
    .eq('store_id', store_id)
    .eq('line_user_id', line_user_id)
    .eq('status', 'temporary')

  await createGoogleCalendarEventForReservation(
    supabaseClient,
    reservationId,
    store_id,
    startDateTime,
    endDateTime,
    staff_id || null,
    menu_id || null,
    real_name,
    display_name,
    line_user_id!,
    memo || '',
    googleClient,
  )

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export type CancelReservationParams = {
  reservation_id?: string
  store_id?: string
  line_user_id?: string
  isManualRegistration: boolean
}

export async function handleCancelReservation(
  supabaseClient: SupabaseClientType,
  params: CancelReservationParams,
  corsHeaders: CorsHeaders
): Promise<Response> {
  const { reservation_id, line_user_id, isManualRegistration } = params

  if (!reservation_id) throw new ClientVisibleError('Reservation ID is required')
  if (!isValidUUID(reservation_id)) throw new ClientVisibleError('Invalid reservation_id format')
  console.log(`[Booking] Cancelling reservation: ${reservation_id}`)

  const { data: reservation, error: fetchError } = await supabaseClient
    .from('reservations')
    .select('google_event_id, store_id, line_user_id')
    .eq('id', reservation_id)
    .single()

  if (fetchError) throw new ClientVisibleError(toErrorMessage(fetchError))

  if (!isManualRegistration && reservation.line_user_id !== line_user_id) {
    throw new ClientVisibleError('自分の予約のみキャンセルできます', 403)
  }

  const { error } = await supabaseClient
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', reservation_id)

  if (error) throw new ClientVisibleError(toErrorMessage(error))

  if (reservation?.google_event_id) {
    const googleClient = await getGoogleCalendarClient(supabaseClient, reservation.store_id)
    if (googleClient) {
      try {
        await deleteGoogleEvent(googleClient, reservation.google_event_id)
      } catch (gError) {
        console.error('Failed to delete Google Calendar event:', gError)
      }
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export type UpdateReservationParams = {
  reservation_id?: string
  store_id?: string
  line_user_id?: string
  date?: string
  time?: string
  staff_id?: string
  menu_id?: string
  memo?: string
  display_name?: string
  profile_picture_url?: string
  real_name?: string
  furigana?: string
  isManualRegistration: boolean
}

export async function handleUpdateReservation(
  supabaseClient: SupabaseClientType,
  params: UpdateReservationParams,
  corsHeaders: CorsHeaders
): Promise<Response> {
  const {
    reservation_id,
    store_id,
    line_user_id,
    date,
    time,
    staff_id,
    menu_id,
    memo,
    display_name,
    profile_picture_url,
    real_name,
    furigana,
    isManualRegistration,
  } = params

  if (!reservation_id) throw new ClientVisibleError('reservation_id is required')
  if (!store_id || !date || !time) throw new ClientVisibleError('store_id, date, and time are required')
  if (!isValidUUID(reservation_id)) throw new ClientVisibleError('Invalid reservation_id format')
  if (!isValidUUID(store_id)) throw new ClientVisibleError('Invalid store_id format')
  if (!isValidDate(date)) throw new ClientVisibleError('Invalid date format (expected YYYY-MM-DD)')
  if (!isValidTime(time)) throw new ClientVisibleError('Invalid time format (expected HH:MM)')
  if (staff_id && !isValidUUID(staff_id)) throw new ClientVisibleError('Invalid staff_id format')
  if (menu_id && !isValidUUID(menu_id)) throw new ClientVisibleError('Invalid menu_id format')

  const { data: oldReservation, error: fetchError } = await supabaseClient
    .from('reservations')
    .select('google_event_id, store_id, line_user_id')
    .eq('id', reservation_id)
    .single()

  if (fetchError) throw new ClientVisibleError(toErrorMessage(fetchError))

  if (!isManualRegistration && oldReservation.line_user_id !== line_user_id) {
    throw new ClientVisibleError('自分の予約のみ変更できます', 403)
  }

  const storeSettings = await getStoreSettings(supabaseClient, store_id)
  if (isPastDate(date, time)) throw new ClientVisibleError('過去の日付は予約できません')
  const maxDays = storeSettings?.max_booking_days ?? 60
  if (!isWithinMaxBookingDays(date, maxDays)) {
    throw new ClientVisibleError(`予約可能日は${maxDays}日後までです`)
  }

  const startDateTime = new Date(`${date}T${time}:00+09:00`)
  let durationMinutes = storeSettings?.slot_interval_minutes ?? 60
  if (menu_id) {
    const { data: menu } = await supabaseClient
      .from('booking_menus')
      .select('duration_minutes')
      .eq('id', menu_id)
      .maybeSingle()
    if (menu?.duration_minutes) durationMinutes = menu.duration_minutes
  }
  if (!durationMinutes || durationMinutes <= 0) durationMinutes = storeSettings?.slot_interval_minutes ?? 60
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000)

  const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)

  // 新予約を先に作成（旧予約は excludeReservationId で容量チェックから除外）
  // 失敗した場合でも旧予約は残るため、予約消失を防ぐ
  const newReservationId = await createReservationWithCapacityCheck({
    supabaseClient,
    store_id,
    line_user_id: line_user_id!,
    date,
    time,
    staff_id: staff_id || null,
    menu_id: menu_id || null,
    memo: memo || '',
    display_name,
    profile_picture_url,
    real_name,
    furigana,
    isManualRegistration,
    excludeReservationId: reservation_id,
    preloadedGoogleClient: googleClient,
  })

  // 新予約が成功したので旧予約をキャンセル
  const { error: cancelError } = await supabaseClient
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', reservation_id)

  if (cancelError) {
    console.error('Failed to cancel old reservation after new one created:', cancelError)
  }

  if (oldReservation?.google_event_id && googleClient) {
    try {
      await deleteGoogleEvent(googleClient, oldReservation.google_event_id)
    } catch (gError) {
      console.error('Failed to delete old Google Calendar event:', gError)
    }
  }

  await supabaseClient
    .from('reservations')
    .delete()
    .eq('store_id', store_id)
    .eq('line_user_id', line_user_id)
    .eq('status', 'temporary')

  await createGoogleCalendarEventForReservation(
    supabaseClient,
    newReservationId,
    store_id,
    startDateTime,
    endDateTime,
    staff_id || null,
    menu_id || null,
    real_name,
    display_name,
    line_user_id!,
    memo || '',
    googleClient,
  )

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
