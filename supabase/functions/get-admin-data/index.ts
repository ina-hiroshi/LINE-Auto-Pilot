import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'
import { isAdminUser } from '../_shared/admin-check.ts'

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const admin = await isAdminUser(supabaseClient, user.id, user.email)
    if (!admin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Service Role Keyを使用して全てのデータを取得
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // リクエストボディを1回だけ読み取る
    const body = await req.json()
    const { type, storeIds, userIds, email } = body

    if (type === 'stores') {
      const { data: storesData, error: storesError } = await supabaseAdmin
        .from('stores')
        .select('id, name')
        .in('id', storeIds || [])

      if (storesError) {
        throw storesError
      }

      return new Response(
        JSON.stringify({ data: storesData || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else if (type === 'profiles') {
      const { data: profilesData, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds || [])

      if (profilesError) {
        throw profilesError
      }

      return new Response(
        JSON.stringify({ data: profilesData || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else if (type === 'profile_by_email') {
      // モニター申込者が既に登録済みかを、申込フォームのメールアドレスから引く。
      // 申込は登録前の見込み客なので user_id を持たず、メールが唯一の手がかりになる。
      if (!email || typeof email !== 'string') {
        return new Response(
          JSON.stringify({ error: 'email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name')
        .ilike('email', email.trim())
        .maybeSingle()

      if (profileError) {
        throw profileError
      }

      if (!profileData) {
        return new Response(
          JSON.stringify({ data: null }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // 代行作業は店舗単位で行うため、所有店舗も一緒に返す。
      const { data: storeData, error: storeError } = await supabaseAdmin
        .from('stores')
        .select('id, name')
        .eq('owner_id', profileData.id)
        .maybeSingle()

      if (storeError) {
        throw storeError
      }

      return new Response(
        JSON.stringify({ data: { profile: profileData, store: storeData || null } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    return safeErrorResponse(error, corsHeaders, 500, 'Internal server error')
  }
})
