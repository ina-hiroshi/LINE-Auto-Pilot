import type { SupabaseClientType } from '../../_shared/types.ts'

export async function getGoogleCalendarClient(supabaseClient: SupabaseClientType, store_id: string) {
  const { data: store } = await supabaseClient.from('stores').select('owner_id').eq('id', store_id).single()
  if (!store) return null

  const { data: settings } = await supabaseClient.from('google_calendar_settings').select('*').eq('user_id', store.owner_id).single()
  if (!settings || !settings.refresh_token) return null

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

export async function listGoogleEvents(client: { accessToken: string; calendarId: string }, timeMin: string, timeMax: string) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(client.calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${client.accessToken}` } }
    )
    const data = await response.json()
    console.log('[Booking] Google Calendar events fetched:', JSON.stringify(data.items?.map((e: { summary?: string; description?: string }) => ({ summary: e.summary, description: e.description })) || []))
    return data.items || []
  } catch (e) {
    console.error('Google List Events Error:', e)
    return []
  }
}

export async function createGoogleEvent(client: { accessToken: string; calendarId: string }, eventData: Record<string, unknown>) {
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

export async function deleteGoogleEvent(client: { accessToken: string; calendarId: string }, eventId: string) {
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
