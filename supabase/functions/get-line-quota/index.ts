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
    // 1. Verify Auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // 2. Parse Body
    const { storeId } = await req.json()

    if (!storeId) {
      return new Response(JSON.stringify({ error: 'Missing storeId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 3. Get Channel Access Token
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: lineAccount, error: dbError } = await supabaseAdmin
      .from('line_accounts')
      .select('channel_access_token')
      .eq('store_id', storeId)
      .single()

    if (dbError || !lineAccount) {
      console.error('DB Error:', dbError)
      return new Response(JSON.stringify({ error: 'Line account not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    const token = lineAccount.channel_access_token

    // 4. Fetch Quota, Consumption, and Bot Info from LINE API
    const [quotaRes, consumptionRes, botInfoRes] = await Promise.all([
      fetch('https://api.line.me/v2/bot/message/quota', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('https://api.line.me/v2/bot/message/quota/consumption', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('https://api.line.me/v2/bot/info', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])

    if (!quotaRes.ok || !consumptionRes.ok) {
      console.error('LINE API Error', await quotaRes.text(), await consumptionRes.text())
      return new Response(JSON.stringify({ error: 'Failed to fetch data from LINE' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      })
    }

    const quotaData = await quotaRes.json()
    const consumptionData = await consumptionRes.json()
    const botInfoData = botInfoRes.ok ? await botInfoRes.json() : {}

    return new Response(JSON.stringify({
      type: quotaData.type,
      limit: quotaData.value, // Can be undefined if type is 'none'
      totalUsage: consumptionData.totalUsage,
      basicId: botInfoData.basicId,
      displayName: botInfoData.displayName
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
