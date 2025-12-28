import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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

const toJstDate = (date: string, time: string) => new Date(`${date}T${time}:00+09:00`)

const isOverlapping = (startA: Date, endA: Date, startB: Date, endB: Date) => startA < endB && endA > startB

// --- Google Calendar Helpers ---

async function getGoogleCalendarClient(supabaseClient: any, store_id: string) {
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

async function createGoogleEvent(client: { accessToken: string; calendarId: string }, eventData: any) {
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

async function updateGoogleEvent(client: { accessToken: string; calendarId: string }, eventId: string, eventData: any) {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { accessToken, action, store_id, line_user_id: requestLineUserId, display_name, profile_picture_url, real_name, furigana, date, time, reservation_id, staff_id, menu_id, memo } = await req.json()

    // --- Security: Verify Access Token ---
    let line_user_id = requestLineUserId;
    let verifiedUserId: string | null = null;

    if (accessToken) {
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

    // Enforce Authentication for sensitive actions
    const sensitiveActions = ['check_customer', 'create_reservation', 'get_active_reservation', 'cancel_reservation', 'update_reservation'];
    if (sensitiveActions.includes(action) && !verifiedUserId) {
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

    if (action === 'get_available_slots') {
      if (!store_id || !date) throw new Error('store_id and date are required')
      
      const storeSettings = await getStoreSettings(store_id)
      const slotInterval = storeSettings?.slot_interval_minutes ?? 60

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

      const capacityLimit = menuCapacity ?? storeSettings?.capacity_per_slot ?? 1
      const dayStart = toJstDate(date, '00:00').toISOString()
      const dayEnd = toJstDate(date, '23:59').toISOString()

      const { data: reservations, error } = await supabaseClient
        .from('reservations')
        .select('start_time, end_time')
        .eq('store_id', store_id)
        .neq('status', 'cancelled')
        .lt('start_time', dayEnd)
        .gt('end_time', dayStart)

      if (error) throw error

      // --- Google Calendar Sync ---
      const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
      let googleEvents: { start: { dateTime?: string }; end: { dateTime?: string } }[] = []
      
      if (googleClient) {
        googleEvents = await listGoogleEvents(googleClient, dayStart, dayEnd)
      }
      // ----------------------------

      let effectiveHours: BusinessHourSlot[] = []
      if (storeSettings?.business_hours) {
        effectiveHours = parseBusinessHours(storeSettings.business_hours, date)
      } else {
        effectiveHours = [{ start: '10:00', end: '20:00' }]
      }

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

          // Check Google Calendar Events
          const googleOverlapCount = googleEvents.filter((e) => {
            if (!e.start.dateTime || !e.end.dateTime) return false // Skip all-day events for now or handle them differently
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
          
          const totalOverlap = internalOverlapCount + googleOverlapCount
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

        if (reservation.line_user_id !== line_user_id) {
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

      if (oldReservation.line_user_id !== line_user_id) {
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
      const capacityLimit = menuCapacity ?? storeSettings?.capacity_per_slot ?? 1

      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000)

      const { data: overlapReservations, error: overlapError } = await supabaseClient
        .from('reservations')
        .select('id')
        .eq('store_id', store_id)
        .neq('status', 'cancelled')
        .lt('start_time', endDateTime.toISOString())
        .gt('end_time', startDateTime.toISOString())
      if (overlapError) throw overlapError
      if ((overlapReservations?.length ?? 0) >= capacityLimit) {
        throw new Error('この時間帯の予約枠が埋まっています')
      }

      // --- Google Calendar Check (Double Check) ---
      const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
      if (googleClient) {
        const googleEvents = await listGoogleEvents(googleClient, startDateTime.toISOString(), endDateTime.toISOString())
        const googleOverlapCount = googleEvents.filter((e) => {
            if (!e.start.dateTime || !e.end.dateTime) return false
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
      if (googleClient && newReservation) {
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
      const capacityLimit = menuCapacity ?? storeSettings?.capacity_per_slot ?? 1

      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000)

      // Capacity check (overlap)
      const { data: overlapReservations, error: overlapError } = await supabaseClient
        .from('reservations')
        .select('id')
        .eq('store_id', store_id)
        .neq('status', 'cancelled')
        .lt('start_time', endDateTime.toISOString())
        .gt('end_time', startDateTime.toISOString())
      if (overlapError) throw overlapError
      if ((overlapReservations?.length ?? 0) >= capacityLimit) {
        throw new Error('この時間帯の予約枠が埋まっています')
      }

      // --- Google Calendar Check (Double Check) ---
      const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
      if (googleClient) {
        const googleEvents = await listGoogleEvents(googleClient, startDateTime.toISOString(), endDateTime.toISOString())
        const googleOverlapCount = googleEvents.filter((e) => {
            if (!e.start.dateTime || !e.end.dateTime) return false
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
          menu_id: menu_id || null
        })
        .select()
        .single()

      if (resError) throw resError

      // --- Google Calendar Create Event ---
      if (googleClient && newReservation) {
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

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Return 200 so the client can read the error message
    })
  }
})
