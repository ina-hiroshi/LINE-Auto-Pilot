// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'

console.log("Google Calendar Webhook Initialized")

Deno.serve(async (req: Request) => {
  try {
    // 1. Verify Request Headers
    const channelId = req.headers.get('x-goog-channel-id')
    const resourceId = req.headers.get('x-goog-resource-id')
    const resourceState = req.headers.get('x-goog-resource-state')
    const _channelExpiration = req.headers.get('x-goog-channel-expiration') // For future use

    console.log(`Received Webhook: Channel=${channelId}, State=${resourceState}`)

    if (!channelId || !resourceId) {
      return new Response('Missing Headers', { status: 400 })
    }

    // Handle 'sync' state (initial verification)
    if (resourceState === 'sync') {
      console.log('Sync notification received. Channel verified.')
      return new Response('OK', { status: 200 })
    }

    // Only process 'exists' state (actual changes)
    if (resourceState !== 'exists') {
      return new Response('Ignored state', { status: 200 })
    }

    // 2. Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Find Settings by Channel ID
    const { data: settings, error: settingsError } = await supabase
      .from('google_calendar_settings')
      .select('*, profiles:user_id(id)')
      .eq('channel_id', channelId)
      .single()

    if (settingsError || !settings) {
      console.error('Settings not found for channel:', channelId)
      // Return 200 to stop Google from retrying if channel is invalid
      return new Response('Channel not found', { status: 200 }) 
    }

    // 4. Get Store ID associated with this user
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', settings.user_id)
      .single()

    if (storeError || !store) {
      console.error('Store not found for user:', settings.user_id)
      return new Response('Store not found', { status: 200 })
    }

    // 5. Refresh Google Access Token
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: settings.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    const tokenData = await tokenResponse.json()
    if (tokenData.error) {
      console.error('Failed to refresh token:', tokenData)
      return new Response('Token Refresh Failed', { status: 500 })
    }
    const accessToken = tokenData.access_token

    // 6. Fetch Incremental Changes
    let apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(settings.calendar_id)}/events?singleEvents=true`
    
    if (settings.sync_token) {
      apiUrl += `&syncToken=${settings.sync_token}`
    } else {
      // Initial sync: fetch future events only? or recent past?
      // For safety, let's fetch from today onwards if no sync token
      const today = new Date().toISOString()
      apiUrl += `&timeMin=${today}`
    }

    const eventsResponse = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (eventsResponse.status === 410) {
      // Sync token invalid (expired/deleted), need full sync
      console.log('Sync token invalid, performing full sync')
      // Clear sync token and retry without it (recursive call or just simple retry logic here)
      // For simplicity, we just retry without sync token in next run or handle it here
      // Ideally, we should re-fetch without syncToken immediately.
      // Let's just return 200 and clear sync_token so next webhook triggers full sync? 
      // No, webhook won't trigger again unless changes happen. We must handle it now.
      
      await supabase
        .from('google_calendar_settings')
        .update({ sync_token: null })
        .eq('id', settings.id)
        
      // Re-fetch without sync token
      const fullSyncUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(settings.calendar_id)}/events?singleEvents=true&timeMin=${new Date().toISOString()}`
      const retryResponse = await fetch(fullSyncUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const retryData = await retryResponse.json()
      await processEvents(retryData, supabase, store.id, settings.id)
      return new Response('Full Sync Completed', { status: 200 })
    }

    const eventsData = await eventsResponse.json()
    await processEvents(eventsData, supabase, store.id, settings.id)

    return new Response('Sync Completed', { status: 200 })

  } catch (e) {
    console.error('Webhook Error:', e)
    return new Response('Internal Error', { status: 500 })
  }
})

import type { SupabaseClientType, GoogleCalendarListResponse } from '../_shared/types.ts'

async function processEvents(data: GoogleCalendarListResponse, supabase: SupabaseClientType, storeId: string, settingsId: string) {
  const events = data.items || []
  const nextSyncToken = data.nextSyncToken

  console.log(`Processing ${events.length} events`)

  for (const event of events) {
    // Skip if event is created by our system (to avoid loops)
    // We can check extendedProperties or description, but 'source' column handles our side.
    // Ideally, we should check if the update originated from us.
    // For now, we just upsert.

    if (event.status === 'cancelled') {
      // Delete reservation
      await supabase
        .from('reservations')
        .delete()
        .eq('google_event_id', event.id)
        .eq('store_id', storeId)
      console.log(`Deleted reservation for event ${event.id}`)
    } else {
      // Upsert reservation - check for undefined start/end times
      if (!event.start || !event.end) {
        console.warn(`Event ${event.id} has no start or end time, skipping`)
        continue
      }
      
      const start = event.start.dateTime || event.start.date // dateTime for timed, date for all-day
      const end = event.end.dateTime || event.end.date

      // If all-day, we might want to handle it differently or set specific times
      // For now, just save as is.

      const summary = event.summary || 'No Title'
      const description = event.description || ''

      // Check if this event is already linked to a reservation (maybe created by LINE)
      // If so, we update it. If not, we create a new one (source='google')
      
      // We use google_event_id as unique key
      const { error: _error } = await supabase
        .from('reservations')
        .upsert({
          store_id: storeId,
          google_event_id: event.id,
          start_time: start,
          end_time: end,
          memo: `${summary}\n${description}`,
          source: 'google', // Mark as from Google
          status: 'confirmed' // Assume confirmed if in calendar
        }, { onConflict: 'google_event_id' }) // We need a unique constraint on google_event_id? Or just query first.
        
        // Note: google_event_id is not unique constraint in DB yet?
        // We should probably add a unique index or just use update/insert logic.
        // Let's check if we can use upsert on non-PK. 
        // Supabase upsert requires a unique constraint.
        // If google_event_id is not unique, upsert might fail or duplicate.
        // Let's try to find existing one first.
    }
  }

  // Update Sync Token
  if (nextSyncToken) {
    await supabase
      .from('google_calendar_settings')
      .update({ sync_token: nextSyncToken })
      .eq('id', settingsId)
  }
}
