// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { verifyLineToken } from '../_shared/line-auth.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

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

    // Verify Access Token & Get User Profile from LINE
    const profile = await verifyLineToken(accessToken)
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

  } catch (error: unknown) {
    return safeErrorResponse(error, corsHeaders, 400, 'Internal server error')
  }
})
