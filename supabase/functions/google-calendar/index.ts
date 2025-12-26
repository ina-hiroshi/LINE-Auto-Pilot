import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Get stored refresh token
    const { data: settings } = await supabaseClient
      .from('google_calendar_settings')
      .select('refresh_token')
      .eq('user_id', user.id)
      .single()

    if (!settings?.refresh_token) {
      return new Response(JSON.stringify({ error: 'Google Calendar not connected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')

    // Refresh Access Token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: settings.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    const tokenData = await tokenResponse.json()
    if (tokenData.error) {
      throw new Error(`Failed to refresh token: ${tokenData.error_description || tokenData.error}`)
    }

    const accessToken = tokenData.access_token

    // Handle different actions based on URL path or query param
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    if (action === 'list_calendars') {
      const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      
      const calendarData = await calendarResponse.json()
      
      if (calendarData.error) {
        throw new Error(`Google API Error: ${calendarData.error.message}`)
      }

      return new Response(JSON.stringify({ calendars: calendarData.items }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'list_events') {
      const calendarId = url.searchParams.get('calendar_id') || 'primary'
      const timeMin = url.searchParams.get('timeMin')
      const timeMax = url.searchParams.get('timeMax')

      if (!timeMin || !timeMax) {
        throw new Error('Missing timeMin or timeMax')
      }

      const eventsResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      
      const eventsData = await eventsResponse.json()
      
      if (eventsData.error) {
        throw new Error(`Google API Error: ${eventsData.error.message}`)
      }

      return new Response(JSON.stringify({ events: eventsData.items }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })

  } catch (error: any) {
    console.error('Edge Function Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
