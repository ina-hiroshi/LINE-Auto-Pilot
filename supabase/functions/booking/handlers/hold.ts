import type { SupabaseClientType } from '../../_shared/types.ts'
import type { CorsHeaders } from './types.ts'
import {
  isValidUUID,
  isValidDate,
  isValidTime,
  isPastDate,
  isWithinMaxBookingDays,
  getStoreSettings,
} from './utils.ts'
import { getGoogleCalendarClient, createGoogleEvent, deleteGoogleEvent } from './google-calendar.ts'

export type HoldParams = {
  store_id?: string
  line_user_id?: string
  date?: string
  time?: string
  staff_id?: string
  menu_id?: string
  display_name?: string
}

export async function handleHoldSlot(
  supabaseClient: SupabaseClientType,
  params: HoldParams,
  corsHeaders: CorsHeaders
): Promise<Response> {
  const { store_id, line_user_id, date, time, staff_id, menu_id, display_name } = params

  if (!store_id || !date || !time) throw new Error('store_id, date, and time are required')
  if (!isValidUUID(store_id)) throw new Error('Invalid store_id format')
  if (!isValidDate(date)) throw new Error('Invalid date format (expected YYYY-MM-DD)')
  if (!isValidTime(time)) throw new Error('Invalid time format (expected HH:MM)')
  if (staff_id && !isValidUUID(staff_id)) throw new Error('Invalid staff_id format')
  if (menu_id && !isValidUUID(menu_id)) throw new Error('Invalid menu_id format')

  const storeSettings = await getStoreSettings(supabaseClient, store_id)
  if (isPastDate(date, time)) throw new Error('過去の日付は予約できません')
  const maxDays = storeSettings?.max_booking_days ?? 60
  if (!isWithinMaxBookingDays(date, maxDays)) {
    throw new Error(`予約可能日は${maxDays}日後までです`)
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

  const { data: existingHolds } = await supabaseClient
    .from('temporary_holds')
    .select('google_event_id')
    .eq('line_user_id', line_user_id)
    .eq('store_id', store_id)

  const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
  if (googleClient && existingHolds && existingHolds.length > 0) {
    for (const hold of existingHolds) {
      if (hold.google_event_id) {
        try {
          await deleteGoogleEvent(googleClient, hold.google_event_id)
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
  if (googleClient) {
    try {
      const eventData = {
        summary: '【仮予約】' + (display_name || 'お客様'),
        description: `仮押さえ中\nユーザーID: ${line_user_id}`,
        start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Tokyo' },
        end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Tokyo' },
        colorId: '11',
      }
      googleEventId = await createGoogleEvent(googleClient, eventData)
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

  if (holdError) throw holdError

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
