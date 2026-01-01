// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
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
    const { messageLogId, replyText, userId } = await req.json()

    if (!messageLogId || !replyText || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Initialize Admin Client for DB operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Get Store ID from Log to find the correct Access Token
    const { data: logData, error: logError } = await supabaseAdmin
        .from('customer_logs')
        .select('store_id')
        .eq('id', messageLogId)
        .single()
    
    if (logError || !logData) {
        console.error('Log lookup error:', logError)
        throw new Error('Log not found')
    }

    // 4. Get Access Token from line_accounts
    const { data: accountData } = await supabaseAdmin
        .from('line_accounts')
        .select('channel_access_token')
        .eq('store_id', logData.store_id)
        .single()

    let channelAccessToken = accountData?.channel_access_token

    // Fallback to env var if not found in DB (for single tenant dev)
    if (!channelAccessToken) {
        console.warn('No channel access token in DB, using env var')
        channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
    }

    if (!channelAccessToken) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set')
    }

    // 5. Send Push Message to LINE
    const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: 'text',
            text: replyText,
          },
        ],
      }),
    })

    if (!lineResponse.ok) {
      const errorText = await lineResponse.text()
      console.error('LINE API Error:', errorText)
      throw new Error(`Failed to send message to LINE: ${errorText}`)
    }

    // 6. Update customer_logs in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('customer_logs')
      .update({
        status: 'manual_replied',
        reply_content: replyText,
      })
      .eq('id', messageLogId)

    if (updateError) {
      console.error('Supabase Update Error:', updateError)
      throw new Error(`Failed to update message log: ${updateError.message}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
