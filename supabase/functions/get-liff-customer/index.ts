import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyLineToken } from '../_shared/line-auth.ts'

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { accessToken, storeId } = await req.json()

    if (!accessToken || !storeId) {
      throw new Error('Missing access token or store ID')
    }

    // 0. Fetch Channel ID from store settings
    const { data: lineAccount } = await supabaseClient
      .from('line_accounts')
      .select('channel_id')
      .eq('store_id', storeId)
      .maybeSingle()

    // 1. Verify Access Token & Get User Profile from LINE
    const profile = await verifyLineToken(accessToken, lineAccount?.channel_id)
    const lineUserId = profile.userId

    // 2. Fetch Customer Data (Securely using Service Role)
    const { data: customer, error: customerError } = await supabaseClient
      .from('customers')
      .select('*')
      .eq('store_id', storeId)
      .eq('line_user_id', lineUserId)
      .maybeSingle()

    if (customerError) throw customerError

    // 3. Fetch Points Data
    const { data: points, error: pointsError } = await supabaseClient
      .from('points')
      .select('balance')
      .eq('store_id', storeId)
      .eq('line_user_id', lineUserId)
      .maybeSingle()

    if (pointsError) throw pointsError

    // 4. Return Data
    return new Response(
      JSON.stringify({
        customer: customer || null,
        points: points || { balance: 0 },
        lineProfile: {
          userId: lineUserId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
