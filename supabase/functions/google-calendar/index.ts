// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
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
    const { data: settings, error: settingsError } = await supabaseClient
      .from('google_calendar_settings')
      .select('refresh_token, channel_id, resource_id, calendar_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (settingsError) {
      console.error('Settings fetch error:', settingsError)
      return new Response(JSON.stringify({ error: 'Failed to fetch calendar settings' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!settings || !settings.refresh_token) {
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
      // トークンが期限切れまたは取り消された場合、設定を削除して再認証を促す
      if (tokenData.error === 'invalid_grant') {
        console.log('Token expired or revoked, clearing settings for user:', user.id)
        await supabaseClient
          .from('google_calendar_settings')
          .delete()
          .eq('user_id', user.id)
        
        return new Response(JSON.stringify({ 
          error: 'TOKEN_EXPIRED',
          message: 'Googleカレンダーの認証が期限切れです。再連携してください。'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        })
      }
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

    if (action === 'watch') {
      const calendarId = url.searchParams.get('calendar_id') || 'primary'
      const channelId = crypto.randomUUID()
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const webhookUrl = `${supabaseUrl}/functions/v1/google-calendar-webhook`

      console.log(`Starting watch for calendar: ${calendarId}, webhook: ${webhookUrl}`)

      const watchResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: channelId,
            type: 'web_hook',
            address: webhookUrl,
          })
        }
      )

      const watchData = await watchResponse.json()

      if (watchData.error) {
        console.error('Google Watch Error:', watchData)
        throw new Error(`Google Watch Error: ${watchData.error.message}`)
      }

      // Save channel info to DB
      const { error: updateError } = await supabaseClient
        .from('google_calendar_settings')
        .update({
          calendar_id: calendarId,
          channel_id: watchData.id,
          resource_id: watchData.resourceId,
          expiration: watchData.expiration,
          sync_token: null // Reset sync token on new watch
        })
        .eq('user_id', user.id)

      if (updateError) {
        throw new Error(`Database Error: ${updateError.message}`)
      }

      return new Response(JSON.stringify({ success: true, data: watchData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'disconnect') {
      // 1. Stop Watch if exists
      if (settings.channel_id && settings.resource_id) {
        try {
          await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id: settings.channel_id,
              resourceId: settings.resource_id
            })
          })
          console.log('Google Watch Stopped')
        } catch (e) {
          console.error('Failed to stop watch (ignoring):', e)
        }
      }

      // 2. Delete Settings
      const { error: deleteError } = await supabaseClient
        .from('google_calendar_settings')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        throw new Error(`Database Error: ${deleteError.message}`)
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })

  } catch (error: unknown) {
    console.error('Edge Function Error:', error)
    const errorMessage = error instanceof Error
      ? error.message
      : (error as { message?: string })?.message ?? 'Unknown error'

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
