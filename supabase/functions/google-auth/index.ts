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
    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the user from the token
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')
    // Default to env var, but allow override from request
    let redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Missing Google OAuth credentials in Edge Function environment variables')
    }

    // GET: Generate Auth URL
    if (req.method === 'GET') {
      const urlParams = new URL(req.url).searchParams
      const clientRedirectUri = urlParams.get('redirect_uri')
      if (clientRedirectUri) {
        redirectUri = clientRedirectUri
      }

      if (!redirectUri) {
        throw new Error('Missing redirect_uri')
      }

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
        access_type: 'offline',
        prompt: 'consent', // Force consent to ensure we get a refresh token
        state: user.id,
      })
      
      const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
      
      return new Response(JSON.stringify({ url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // POST: Exchange Code for Tokens
    if (req.method === 'POST') {
      const { code, redirect_uri: clientRedirectUri } = await req.json()
      
      if (clientRedirectUri) {
        redirectUri = clientRedirectUri
      }

      if (!code) {
        throw new Error('No code provided')
      }

      if (!redirectUri) {
        throw new Error('Missing redirect_uri')
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })

      const tokens = await tokenResponse.json()

      if (tokens.error) {
        console.error('Google Token Error:', tokens)
        throw new Error(`Google OAuth Error: ${tokens.error_description || tokens.error}`)
      }

      if (!tokens.refresh_token) {
        // This shouldn't happen with prompt=consent, but handle it just in case
        throw new Error('No refresh token returned from Google. Please try again.')
      }

      // Save to database
      const { error: dbError } = await supabaseClient
        .from('google_calendar_settings')
        .upsert({
          user_id: user.id,
          refresh_token: tokens.refresh_token,
          calendar_id: 'primary', // Default to primary calendar
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (dbError) {
        console.error('Database Error:', dbError)
        throw dbError
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

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
