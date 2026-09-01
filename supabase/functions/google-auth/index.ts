// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

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

      // state に user.id をそのまま使うと、第三者が「自分のGoogleアカウント」で
      // 認可を取った上で state だけ被害者の user.id に差し替えたURLを踏ませる
      // CSRFが成立してしまう（user.id は推測・入手されうる値であり、それ自体は
      // 「このブラウザが認可を開始した」ことの証明にならない）。
      // サーバー側で乱数ナンスを発行し、呼び出し元(user.id)に紐づけて保存する。
      // POST側では「現在の認証ユーザー自身に保存された値」との一致のみを見るため、
      // 攻撃者が発行したstateは攻撃者自身のuser_id宛にしか保存されず、
      // 被害者のセッションでは一致しない。
      const oauthState = crypto.randomUUID()
      const { error: stateError } = await supabaseClient
        .from('google_oauth_states')
        .upsert({ user_id: user.id, state: oauthState, created_at: new Date().toISOString() }, { onConflict: 'user_id' })

      if (stateError) {
        throw new Error(`Failed to persist oauth state: ${stateError.message}`)
      }

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
        access_type: 'offline',
        prompt: 'consent', // Force consent to ensure we get a refresh token
        state: oauthState,
      })

      const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
      
      return new Response(JSON.stringify({ url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // POST: Exchange Code for Tokens
    if (req.method === 'POST') {
      const { code, redirect_uri: clientRedirectUri, state } = await req.json()

      if (clientRedirectUri) {
        redirectUri = clientRedirectUri
      }

      if (!code) {
        throw new Error('No code provided')
      }

      if (!redirectUri) {
        throw new Error('Missing redirect_uri')
      }

      // state は GET 時に「現在の認証ユーザー自身」に紐づけてサーバーに
      // 保存した乱数ナンスと完全一致する場合のみ受理する。第三者が別の
      // Googleアカウントで認可を取って組み立てた state は、攻撃者自身の
      // user_id にしか保存されていないため、被害者のセッション（別の
      // user.id）で照合すると必ず不一致になる。15分を超えたものは失効
      // とみなし、成否によらず使用後は必ず削除して使い回しを防ぐ。
      // （Googleログイン→2段階認証→アカウント選択→同意画面の一読、という
      // 一連の流れはモバイルでは数分かかりうるため、5分だと正当な
      // ユーザーまで弾いてしまう恐れがあり15分に緩和した。Googleの
      // 認可コード自体の有効期限も約10分であり、15分がstateの実質的な
      // ボトルネックになることはない）
      if (!state) {
        throw new Error('Invalid state parameter')
      }

      const { data: storedState, error: stateFetchError } = await supabaseClient
        .from('google_oauth_states')
        .select('state, created_at')
        .eq('user_id', user.id)
        .maybeSingle()

      // 成否によらず単発利用のため即座に削除する
      await supabaseClient.from('google_oauth_states').delete().eq('user_id', user.id)

      if (stateFetchError) {
        throw new Error(`Failed to verify oauth state: ${stateFetchError.message}`)
      }

      const isFresh = storedState?.created_at
        ? Date.now() - new Date(storedState.created_at).getTime() < 15 * 60 * 1000
        : false

      if (!storedState || storedState.state !== state || !isFresh) {
        throw new Error('Invalid state parameter')
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
