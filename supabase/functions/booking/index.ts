import { createClient } from '@supabase/supabase-js'
import { verifyLineToken } from '../_shared/line-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type BusinessHourSlot = { start: string; end: string }
type BusinessHoursByDay = Partial<Record<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', BusinessHourSlot[]>>

const parseBusinessHours = (businessHoursRaw: unknown, targetDate: string): BusinessHourSlot[] => {
  try {
    const parsed = (businessHoursRaw ?? {}) as BusinessHoursByDay
    const day = new Date(`${targetDate}T00:00:00`)
    const weekdayKey = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][day.getDay()] ?? 'mon') as keyof BusinessHoursByDay
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
const toJstDate = (date: string, time: string) => {
  // 秒を含む場合は除去（HH:MM のみにする）
  const normalizedTime = time.slice(0, 5)
  return new Date(`${date}T${normalizedTime}:00+09:00`)
}

const isOverlapping = (startA: Date, endA: Date, startB: Date, endB: Date) => startA < endB && endA > startB

// --- Google Calendar Helpers ---

import type { SupabaseClientType } from '../_shared/types.ts'
async function getGoogleCalendarClient(supabaseClient: SupabaseClientType, store_id: string) {
  // 1. Get owner_id from store_id
  const { data: store } = await supabaseClient.from('stores').select('owner_id').eq('id', store_id).single()
  if (!store) return null

  // 2. Get settings
  const { data: settings } = await supabaseClient.from('google_calendar_settings').select('*').eq('user_id', store.owner_id).single()
  if (!settings || !settings.refresh_token) return null

  // 3. Refresh Token
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  
  if (!clientId || !clientSecret) {
    console.error('Missing Google Client ID/Secret')
    return null
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: settings.refresh_token,
        grant_type: 'refresh_token',
      }),
  })
  
  const tokens = await tokenResponse.json()
  if (tokens.error) {
    console.error('Google Token Refresh Error:', tokens)
    return null
  }

  return {
      accessToken: tokens.access_token,
      calendarId: settings.calendar_id || 'primary'
  }
}

async function listGoogleEvents(client: { accessToken: string; calendarId: string }, timeMin: string, timeMax: string) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(client.calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${client.accessToken}` } }
    )
    const data = await response.json()
    return data.items || []
  } catch (e) {
    console.error('Google List Events Error:', e)
    return []
  }
}

async function createGoogleEvent(client: { accessToken: string; calendarId: string }, eventData: Record<string, unknown>) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(client.calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      }
    )
    const data = await response.json()
    return data.id
  } catch (e) {
    console.error('Google Create Event Error:', e)
    return null
  }
}

async function deleteGoogleEvent(client: { accessToken: string; calendarId: string }, eventId: string) {
  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(client.calendarId)}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${client.accessToken}` }
      }
    )
  } catch (e) {
    console.error('Google Delete Event Error:', e)
  }
}

async function _updateGoogleEvent(client: { accessToken: string; calendarId: string }, eventId: string, eventData: Record<string, unknown>) {
  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(client.calendarId)}/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      }
    )
  } catch (e) {
    console.error('Google Update Event Error:', e)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { accessToken, action, store_id, line_user_id: requestLineUserId, display_name, profile_picture_url, real_name, furigana, date, time, reservation_id, staff_id, menu_id, memo, is_manual } = await req.json()

    // --- Security: Verify Access Token ---
    let line_user_id = requestLineUserId;
    let verifiedUserId: string | null = null;
    let isManualRegistration = false;

    // 管理画面からの手動登録の場合はSupabase Auth認証をチェック
    if (is_manual === true) {
      const authHeader = req.headers.get('authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error } = await supabaseClient.auth.getUser(token)
        if (!error && user) {
          // 店舗のオーナーか確認
          const { data: store } = await supabaseClient
            .from('stores')
            .select('owner_id')
            .eq('id', store_id)
            .single()
          
          if (store?.owner_id === user.id) {
            isManualRegistration = true
            // 手動登録の場合はリクエストのline_user_idをそのまま使用
          }
        }
      }
    }

    if (accessToken && !isManualRegistration) {
      try {
        // Fetch Channel ID if store_id is available
        let expectedChannelId: string | undefined;
        if (store_id) {
          const { data: lineAccount } = await supabaseClient
            .from('line_accounts')
            .select('channel_id')
            .eq('store_id', store_id)
            .maybeSingle()
          if (lineAccount?.channel_id) {
            expectedChannelId = lineAccount.channel_id
          }
        }

        const profile = await verifyLineToken(accessToken, expectedChannelId);
        verifiedUserId = profile.userId;
        // Securely overwrite the user ID with the verified one
        line_user_id = verifiedUserId;
      } catch (e) {
        console.error('Token verification failed:', e);
        // If token is invalid, we treat it as unauthenticated
      }
    }

    // Enforce Authentication for sensitive actions (bypass for manual registration)
    const sensitiveActions = ['check_customer', 'create_reservation', 'get_active_reservation', 'cancel_reservation', 'update_reservation'];
    if (sensitiveActions.includes(action) && !verifiedUserId && !isManualRegistration) {
      throw new Error('Unauthorized: Valid Access Token is required for this action');
    }
    // -------------------------------------

    // Helper to fetch store settings only when needed
    const getStoreSettings = async (id: string) => {
      const { data, error } = await supabaseClient
        .from('stores')
        .select('slot_interval_minutes, capacity_per_slot, business_hours')
        .eq('id', id)
        .maybeSingle()
      
      if (error) throw error
      if (!data) throw new Error('Store not found')
      return data
    }

    console.log(`[Booking] Action: ${action}, User: ${line_user_id}, Name: ${display_name}, Pic: ${profile_picture_url ? 'Yes' : 'No'}`)

    if (action === 'check_customer') {
      const { data, error } = await supabaseClient
        .from('customers')
        .select('real_name, furigana, display_name')
        .eq('store_id', store_id)
        .eq('line_user_id', line_user_id)
        .maybeSingle()

      if (error) throw error
      return new Response(JSON.stringify({ customer: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 時間枠の仮押さえ
    if (action === 'hold_slot') {
      if (!store_id || !date || !time) throw new Error('store_id, date, and time are required')

      const storeSettings = await getStoreSettings(store_id)
      let durationMinutes = storeSettings?.slot_interval_minutes ?? 60
      let _menuCapacity: number | null = null // 将来の容量チェック用に保持

      // Menu-specific duration & capacity
      if (menu_id) {
        const { data: menu } = await supabaseClient
          .from('booking_menus')
          .select('duration_minutes, capacity_per_slot')
          .eq('id', menu_id)
          .maybeSingle()
        if (menu?.duration_minutes) durationMinutes = menu.duration_minutes
        if (typeof menu?.capacity_per_slot === 'number') _menuCapacity = menu.capacity_per_slot
      }
      if (!durationMinutes || durationMinutes <= 0) durationMinutes = storeSettings?.slot_interval_minutes ?? 60

      const startDateTime = new Date(`${date}T${time}:00+09:00`)
      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000)

      // このユーザーの既存の仮押さえを削除（新しい選択に置き換え）
      await supabaseClient
        .from('temporary_holds')
        .delete()
        .eq('line_user_id', line_user_id)
        .eq('store_id', store_id)

      // Google Calendarに仮予約を作成
      let googleEventId: string | null = null
      const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
      if (googleClient) {
        try {
          const eventData = {
            summary: '【仮予約】' + (display_name || 'お客様'),
            description: `仮押さえ中\nユーザーID: ${line_user_id}`,
            start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Tokyo' },
            end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Tokyo' },
            colorId: '11', // 赤色で仮予約を強調
          }
          googleEventId = await createGoogleEvent(googleClient, eventData)
        } catch (e) {
          console.error('Failed to create temporary Google event:', e)
        }
      }

      // 仮押さえを作成（10分間有効）
      const { data: hold, error: holdError } = await supabaseClient
        .from('temporary_holds')
        .insert({
          store_id,
          line_user_id,
          staff_id: staff_id || null,
          menu_id: menu_id || null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10分後
          google_event_id: googleEventId,
        })
        .select()
        .single()

      if (holdError) throw holdError

      return new Response(JSON.stringify({ hold_id: hold.id, expires_at: hold.expires_at }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 仮押さえの解除
    if (action === 'release_hold') {
      // このユーザーの仮押さえを取得してGoogle Calendarからも削除
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

      // 仮押さえを削除
      await supabaseClient
        .from('temporary_holds')
        .delete()
        .eq('line_user_id', line_user_id)
        .eq('store_id', store_id)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'get_available_slots') {
      if (!store_id || !date) throw new Error('store_id and date are required')
      
      const storeSettings = await getStoreSettings(store_id)
      const slotInterval = storeSettings?.slot_interval_minutes ?? 60

      // --- 特別営業日/臨時休業日の確認 ---
      const { data: specialDate } = await supabaseClient
        .from('booking_special_dates')
        .select('is_closed, override_hours')
        .eq('store_id', store_id)
        .eq('date', date)
        .maybeSingle()
      
      // 臨時休業日の場合は空のスロットを返す
      if (specialDate?.is_closed) {
        return new Response(JSON.stringify({ slots: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      // -----------------------------------

      // Menu-specific duration & capacity override
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

      // 担当者指定がある場合は、その担当者は1人までしか同時に受付不可
      // 担当者指定がない場合は店舗の基本受付上限を使用
      const capacityLimit = staff_id ? 1 : (menuCapacity ?? storeSettings?.capacity_per_slot ?? 1)
      const dayStart = toJstDate(date, '00:00').toISOString()
      const dayEnd = toJstDate(date, '23:59').toISOString()

      // 担当者指定がある場合は、その担当者の予約のみをチェック
      let query = supabaseClient
        .from('reservations')
        .select('start_time, end_time')
        .eq('store_id', store_id)
        .neq('status', 'cancelled')
        .lt('start_time', dayEnd)
        .gt('end_time', dayStart)
      
      if (staff_id) {
        query = query.eq('staff_id', staff_id)
      }

      const { data: reservations, error } = await query

      if (error) throw error

      // --- 仮押さえのチェック（期限切れは除外） ---
      let holdQuery = supabaseClient
        .from('temporary_holds')
        .select('start_time, end_time, line_user_id')
        .eq('store_id', store_id)
        .gt('expires_at', new Date().toISOString()) // 有効期限内のみ
        .lt('start_time', dayEnd)
        .gt('end_time', dayStart)
      
      if (staff_id) {
        holdQuery = holdQuery.eq('staff_id', staff_id)
      }

      const { data: holds } = await holdQuery
      // --------------------------------------------

      // --- Google Calendar Sync ---
      const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
      let googleEvents: { start: { dateTime?: string }; end: { dateTime?: string } }[] = []
      
      if (googleClient) {
        googleEvents = await listGoogleEvents(googleClient, dayStart, dayEnd)
      }
      // ----------------------------

      // --- スタッフ勤務時間の取得 ---
      let effectiveHours: BusinessHourSlot[] = []
      
      if (staff_id) {
        // スタッフ指定がある場合は、そのスタッフの勤務時間を使用
        const targetDate = new Date(`${date}T00:00:00`)
        const dayOfWeek = targetDate.getDay()
        
        // 基本勤務パターンを取得
        const { data: workPattern } = await supabaseClient
          .from('staff_work_patterns')
          .select('start_time, end_time, is_active')
          .eq('staff_id', staff_id)
          .eq('day_of_week', dayOfWeek)
          .maybeSingle()
        
        console.log(`[Booking] Staff ${staff_id} work pattern for day ${dayOfWeek}:`, workPattern)
        
        // 特別スケジュール（個別日程設定）を取得
        const { data: specialSchedule } = await supabaseClient
          .from('staff_special_schedules')
          .select('is_absent, override_start, override_end')
          .eq('staff_id', staff_id)
          .eq('date', date)
          .maybeSingle()
        
        console.log(`[Booking] Staff ${staff_id} special schedule for ${date}:`, specialSchedule)
        
        // 優先順位: 特別スケジュール > 基本勤務パターン
        if (specialSchedule) {
          if (specialSchedule.is_absent) {
            // 欠勤日は予約不可
            console.log(`[Booking] Staff ${staff_id} is absent on ${date}`)
            effectiveHours = []
          } else if (specialSchedule.override_start && specialSchedule.override_end) {
            // 個別日程設定がある場合
            effectiveHours = [{ start: specialSchedule.override_start, end: specialSchedule.override_end }]
          } else {
            // 基本勤務パターンにフォールバック
            if (workPattern?.is_active && workPattern.start_time && workPattern.end_time) {
              effectiveHours = [{ start: workPattern.start_time, end: workPattern.end_time }]
            } else {
              effectiveHours = []
            }
          }
        } else if (workPattern?.is_active) {
          // 基本勤務パターンを使用 (start_time/end_time を使用)
          if (workPattern.start_time && workPattern.end_time) {
            effectiveHours = [{ start: workPattern.start_time, end: workPattern.end_time }]
          } else {
            effectiveHours = []
          }
        }
        // workPattern が null (未登録) の場合は effectiveHours = [] のまま
        
        console.log(`[Booking] Staff ${staff_id} effective hours:`, effectiveHours)
        
        // スタッフの勤務時間がない場合は予約不可
        if (effectiveHours.length === 0) {
          console.log(`[Booking] No available slots for staff ${staff_id} on ${date}`)
          return new Response(JSON.stringify({ slots: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } else {
        // スタッフ指定がない場合は店舗営業時間を使用
        // 特別営業日の営業時間上書きがある場合はそちらを優先
        if (specialDate?.override_hours && Array.isArray(specialDate.override_hours) && specialDate.override_hours.length > 0) {
          effectiveHours = specialDate.override_hours
        } else if (storeSettings?.business_hours) {
          effectiveHours = parseBusinessHours(storeSettings.business_hours, date)
        } else {
          effectiveHours = [{ start: '10:00', end: '20:00' }]
        }
      }
      // ----------------------------

      const slots: { time: string; available: boolean }[] = []

      for (const hourRange of effectiveHours) {
        const rangeStart = toJstDate(date, hourRange.start)
        const rangeEnd = toJstDate(date, hourRange.end)

        for (let cursor = new Date(rangeStart); cursor < rangeEnd; cursor = new Date(cursor.getTime() + slotInterval * 60000)) {
          const slotEnd = new Date(cursor.getTime() + durationMinutes * 60000)
          if (slotEnd > rangeEnd) continue

          // Check Internal Reservations
          const internalOverlapCount = (reservations || []).filter((r) => {
            const resStart = new Date(r.start_time)
            const resEnd = new Date(r.end_time)
            return isOverlapping(cursor, slotEnd, resStart, resEnd)
          }).length

          // Check Temporary Holds (自分の仮押さえは除外)
          const holdOverlapCount = (holds || []).filter((h) => {
            if (h.line_user_id === line_user_id) return false // 自分の仮押さえは除外
            const holdStart = new Date(h.start_time)
            const holdEnd = new Date(h.end_time)
            return isOverlapping(cursor, slotEnd, holdStart, holdEnd)
          }).length

          // Check Google Calendar Events
          type GoogleEvent = { start?: { dateTime?: string }; end?: { dateTime?: string } }
          const googleOverlapCount = googleEvents.filter((e: GoogleEvent) => {
            if (!e.start?.dateTime || !e.end?.dateTime) return false // Skip all-day events for now or handle them differently
            const resStart = new Date(e.start.dateTime)
            const resEnd = new Date(e.end.dateTime)
            return isOverlapping(cursor, slotEnd, resStart, resEnd)
          }).length

          // If ANY Google event overlaps, the slot is blocked (assuming Google Calendar events block availability completely)
          // Or should we treat them as consuming 1 capacity? Usually Google Calendar events mean "busy".
          // Let's assume Google Calendar event consumes 1 capacity unit, or blocks it entirely?
          // Requirement says "Google Calendar events are treated as busy slots".
          // If capacity > 1, maybe we just subtract 1?
          // For safety, let's assume Google Event blocks 1 slot.
          
          const totalOverlap = internalOverlapCount + holdOverlapCount + googleOverlapCount
          const available = totalOverlap < capacityLimit
          
          // Convert to JST for display (Shift UTC+9)
          // cursor is a Date object representing the correct absolute time.
          // getHours() returns UTC hour in Deno Deploy.
          // We want the hour in JST.
          const jstDate = new Date(cursor.getTime() + 9 * 60 * 60 * 1000)
          const hh = jstDate.getUTCHours().toString().padStart(2, '0')
          const mm = jstDate.getUTCMinutes().toString().padStart(2, '0')
          slots.push({ time: `${hh}:${mm}`, available })
        }
      }

      return new Response(JSON.stringify({ slots }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'get_active_reservation') {
      const now = new Date().toISOString()
      const { data, error } = await supabaseClient
        .from('reservations')
        .select('*, staff:staff_members(name), menu:booking_menus(name, price)')
        .eq('store_id', store_id)
        .eq('line_user_id', line_user_id)
        .neq('status', 'cancelled')
        .gte('start_time', now)
        .order('start_time', { ascending: true })
        // .limit(1) // 複数予約に対応するためlimitを削除

      if (error) throw error
      return new Response(JSON.stringify({ reservations: data }), { // reservation -> reservations (Array)
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'cancel_reservation') {
        if (!reservation_id) throw new Error('Reservation ID is required')
        console.log(`[Booking] Cancelling reservation: ${reservation_id}`)

        // Fetch reservation to get google_event_id
        const { data: reservation, error: fetchError } = await supabaseClient
            .from('reservations')
            .select('google_event_id, store_id, line_user_id')
            .eq('id', reservation_id)
            .single()
        
        if (fetchError) throw fetchError

        // 管理画面からの操作（オーナー認証済み）か、自分の予約かをチェック
        if (!isManualRegistration && reservation.line_user_id !== line_user_id) {
          throw new Error('Unauthorized: You can only cancel your own reservations')
        }

        const { error } = await supabaseClient
            .from('reservations')
            .update({ status: 'cancelled' })
            .eq('id', reservation_id)
        
        if (error) throw error

        // --- Google Calendar Delete Event ---
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
        // ------------------------------------

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    if (action === 'update_reservation') {
      // 1. Cancel old reservation
      // Fetch old reservation to get google_event_id
      const { data: oldReservation, error: fetchError } = await supabaseClient
          .from('reservations')
          .select('google_event_id, store_id, line_user_id')
          .eq('id', reservation_id)
          .single()
      
      if (fetchError) throw fetchError

      // 管理画面からの操作（オーナー認証済み）か、自分の予約かをチェック
      if (!isManualRegistration && oldReservation.line_user_id !== line_user_id) {
        throw new Error('Unauthorized: You can only update your own reservations')
      }

      const { error: cancelError } = await supabaseClient
          .from('reservations')
          .update({ status: 'cancelled' })
          .eq('id', reservation_id)
      
      if (cancelError) throw cancelError

      // --- Google Calendar Delete Old Event ---
      if (oldReservation?.google_event_id) {
          const googleClient = await getGoogleCalendarClient(supabaseClient, oldReservation.store_id)
          if (googleClient) {
              try {
                  await deleteGoogleEvent(googleClient, oldReservation.google_event_id)
              } catch (gError) {
                  console.error('Failed to delete old Google Calendar event:', gError)
              }
          }
      }
      // ----------------------------------------

      // 2. Create new reservation (Same logic as create_reservation)
      // 0. Get line_account_id
      const { data: lineAccount, error: laError } = await supabaseClient
        .from('line_accounts')
        .select('id')
        .eq('store_id', store_id)
        .maybeSingle()
      
      if (laError) throw laError
      if (!lineAccount) throw new Error('LINE Account not found for this store')

      // 1. Upsert Customer
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

      if (custError) throw custError

      // 2. Create Reservation
      // Treat input time as JST (+09:00)
      const startDateTime = new Date(`${date}T${time}:00+09:00`)

      const storeSettings = await getStoreSettings(store_id)
      let durationMinutes = storeSettings?.slot_interval_minutes ?? 60
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
      if (!durationMinutes || durationMinutes <= 0) durationMinutes = storeSettings?.slot_interval_minutes ?? 60
      // 担当者指定がある場合は、その担当者は1人までしか同時に受付不可
      const capacityLimit = staff_id ? 1 : (menuCapacity ?? storeSettings?.capacity_per_slot ?? 1)

      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000)

      // 担当者指定がある場合は、その担当者の予約のみをチェック
      let updateOverlapQuery = supabaseClient
        .from('reservations')
        .select('id')
        .eq('store_id', store_id)
        .neq('status', 'cancelled')
        .lt('start_time', endDateTime.toISOString())
        .gt('end_time', startDateTime.toISOString())
      
      if (staff_id) {
        updateOverlapQuery = updateOverlapQuery.eq('staff_id', staff_id)
      }

      const { data: overlapReservations, error: overlapError } = await updateOverlapQuery
      if (overlapError) throw overlapError
      if ((overlapReservations?.length ?? 0) >= capacityLimit) {
        throw new Error('この時間帯の予約枠が埋まっています')
      }

      // --- Google Calendar Check (Double Check) for UPDATE ---
      const googleClient1 = await getGoogleCalendarClient(supabaseClient, store_id)
      if (googleClient1) {
        const googleEvents1 = await listGoogleEvents(googleClient1, startDateTime.toISOString(), endDateTime.toISOString())
        type GoogleEvent1 = { start?: { dateTime?: string }; end?: { dateTime?: string } }
        const googleOverlapCount = googleEvents1.filter((e: GoogleEvent1) => {
            if (!e.start?.dateTime || !e.end?.dateTime) return false
            const resStart = new Date(e.start.dateTime)
            const resEnd = new Date(e.end.dateTime)
            return isOverlapping(startDateTime, endDateTime, resStart, resEnd)
        }).length
        
        if (googleOverlapCount > 0 && capacityLimit <= 1) {
             throw new Error('この時間帯はGoogleカレンダーの予定と重複しています')
        }
      }
      // --------------------------------------------

      const { data: newReservation, error: resError } = await supabaseClient
        .from('reservations')
        .insert({
          store_id,
          line_account_id: lineAccount.id,
          line_user_id,
          reservation_datetime: startDateTime.toISOString(),
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'confirmed',
          memo: memo || '',
          staff_id: staff_id || null,
          menu_id: menu_id || null
        })
        .select()
        .single()

      if (resError) throw resError

      // --- Google Calendar Create Event ---
      if (googleClient1 && newReservation) {
        try {
            // Fetch Staff Name
            let staffName = '指定なし'
            if (staff_id) {
               const { data: staff } = await supabaseClient.from('staff_members').select('name').eq('id', staff_id).maybeSingle()
               if (staff) staffName = staff.name
            }

            // Fetch Menu Name
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

            const eventId = await createGoogleEvent(googleClient1, {
                summary,
                description,
                start: { dateTime: startDateTime.toISOString() },
                end: { dateTime: endDateTime.toISOString() }
            })
            
            if (eventId) {
                await supabaseClient
                    .from('reservations')
                    .update({ google_event_id: eventId })
                    .eq('id', newReservation.id)
            }
        } catch (gError) {
            console.error('Failed to create Google Calendar event:', gError)
        }
      }
      // ------------------------------------

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'create_reservation') {
      // 0. Get line_account_id
      const { data: lineAccount, error: laError } = await supabaseClient
        .from('line_accounts')
        .select('id')
        .eq('store_id', store_id)
        .maybeSingle()
      
      if (laError) throw laError
      if (!lineAccount) throw new Error('LINE Account not found for this store')

      // 1. Upsert Customer
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

      if (custError) throw custError

      // 2. Create Reservation
      // Treat input time as JST (+09:00)
      const startDateTime = new Date(`${date}T${time}:00+09:00`)

      // Menu-specific duration & capacity
      const storeSettings = await getStoreSettings(store_id)
      let durationMinutes = storeSettings?.slot_interval_minutes ?? 60
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
      if (!durationMinutes || durationMinutes <= 0) durationMinutes = storeSettings?.slot_interval_minutes ?? 60
      // 担当者指定がある場合は、その担当者は1人までしか同時に受付不可
      const capacityLimit = staff_id ? 1 : (menuCapacity ?? storeSettings?.capacity_per_slot ?? 1)

      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000)

      // Capacity check (overlap) - 担当者指定がある場合は、その担当者の予約のみをチェック
      let overlapQuery = supabaseClient
        .from('reservations')
        .select('id')
        .eq('store_id', store_id)
        .neq('status', 'cancelled')
        .lt('start_time', endDateTime.toISOString())
        .gt('end_time', startDateTime.toISOString())
      
      if (staff_id) {
        overlapQuery = overlapQuery.eq('staff_id', staff_id)
      }

      const { data: overlapReservations, error: overlapError } = await overlapQuery
      if (overlapError) throw overlapError

      // --- 仮押さえチェック（他のユーザーの仮押さえがないか確認） ---
      let holdCheckQuery = supabaseClient
        .from('temporary_holds')
        .select('id, line_user_id')
        .eq('store_id', store_id)
        .gt('expires_at', new Date().toISOString())
        .lt('start_time', endDateTime.toISOString())
        .gt('end_time', startDateTime.toISOString())
      
      if (staff_id) {
        holdCheckQuery = holdCheckQuery.eq('staff_id', staff_id)
      }

      const { data: conflictingHolds } = await holdCheckQuery
      const otherUsersHold = (conflictingHolds || []).filter(h => h.line_user_id !== line_user_id)
      
      if ((overlapReservations?.length ?? 0) + otherUsersHold.length >= capacityLimit) {
        throw new Error('この時間帯の予約枠が埋まっています')
      }
      // -------------------------------------------------------------

      // --- Google Calendar Check (Double Check) for CREATE ---
      const googleClient2 = await getGoogleCalendarClient(supabaseClient, store_id)
      if (googleClient2) {
        const googleEvents2 = await listGoogleEvents(googleClient2, startDateTime.toISOString(), endDateTime.toISOString())
        type GoogleEvent2 = { start?: { dateTime?: string }; end?: { dateTime?: string } }
        const googleOverlapCount = googleEvents2.filter((e: GoogleEvent2) => {
            if (!e.start?.dateTime || !e.end?.dateTime) return false
            const resStart = new Date(e.start.dateTime)
            const resEnd = new Date(e.end.dateTime)
            return isOverlapping(startDateTime, endDateTime, resStart, resEnd)
        }).length
        
        if (googleOverlapCount > 0 && capacityLimit <= 1) {
             throw new Error('この時間帯はGoogleカレンダーの予定と重複しています')
        }
      }
      // --------------------------------------------

      const { data: newReservation, error: resError } = await supabaseClient
        .from('reservations')
        .insert({
          store_id,
          line_account_id: lineAccount.id,
          line_user_id,
          reservation_datetime: startDateTime.toISOString(), // For backward compatibility
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'confirmed',
          memo: memo || '',
          staff_id: staff_id || null,
          menu_id: menu_id || null,
          registration_type: isManualRegistration ? 'manual' : 'line'
        })
        .select()
        .single()

      if (resError) throw resError

      // --- 仮押さえを削除し、Google Calendarの仮予約イベントも削除 ---
      const { data: userHolds } = await supabaseClient
        .from('temporary_holds')
        .select('*')
        .eq('line_user_id', line_user_id)
        .eq('store_id', store_id)

      if (userHolds && userHolds.length > 0) {
        for (const hold of userHolds) {
          if (hold.google_event_id && googleClient2) {
            try {
              await deleteGoogleEvent(googleClient2, hold.google_event_id)
            } catch (e) {
              console.error('Failed to delete temporary Google event:', e)
            }
          }
        }
        
        await supabaseClient
          .from('temporary_holds')
          .delete()
          .eq('line_user_id', line_user_id)
          .eq('store_id', store_id)
      }
      // ---------------------------------------------------------------

      // --- Google Calendar Create Event ---
      if (googleClient2 && newReservation) {
        try {
            // Fetch Staff Name
            let staffName = '指定なし'
            if (staff_id) {
               const { data: staff } = await supabaseClient.from('staff_members').select('name').eq('id', staff_id).maybeSingle()
               if (staff) staffName = staff.name
            }

            // Fetch Menu Name
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

            const eventId = await createGoogleEvent(googleClient2, {
                summary,
                description,
                start: { dateTime: startDateTime.toISOString() },
                end: { dateTime: endDateTime.toISOString() }
            })
            
            if (eventId) {
                await supabaseClient
                    .from('reservations')
                    .update({ google_event_id: eventId })
                    .eq('id', newReservation.id)
            }
        } catch (gError) {
            console.error('Failed to create Google Calendar event:', gError)
        }
      }
      // ------------------------------------

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Invalid action')

  } catch (error: unknown) {
    console.error('Booking Function Error:', error)
    const errorMessage = error instanceof Error
      ? error.message
      : (error as { message?: string })?.message ?? 'Unknown error'

    // エラー内容に応じたステータスコードを返す
    const isAuthError = errorMessage.toLowerCase().includes('unauthorized')
    const isNotFoundError = errorMessage.toLowerCase().includes('not found')
    const statusCode = isAuthError ? 401 : isNotFoundError ? 404 : 400

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode,
    })
  }
})
