import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("LINE Webhook Function Initialized")

// Helper to verify LINE signature using Web Crypto API
async function verifySignature(channelSecret: string, body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body)
  )
  const hash = btoa(String.fromCharCode(...new Uint8Array(signed)))
  return hash === signature
}

// Helper to reply message using fetch
async function replyMessage(accessToken: string, replyToken: string, messages: any[]) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: messages
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LINE API Error: ${response.status} ${errorText}`)
  }
}

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const signature = req.headers.get('x-line-signature')
    if (!signature) {
      return new Response('Bad Request: Missing Signature', { status: 400 })
    }

    const body = await req.text()
    
    // Parse body to get destination (Bot User ID) to find the correct channel secret
    const jsonBody = JSON.parse(body)
    const destination = jsonBody.destination
    const events = jsonBody.events || []

    console.log('Received event for destination:', destination)

    if (!destination) {
       console.warn('No destination in body, cannot verify signature without channel secret lookup.')
       // For verification endpoint or cases without destination, we might need a fallback or return OK
       if (events.length === 0) {
          return new Response(JSON.stringify({ message: 'OK' }), { headers: { "Content-Type": "application/json" } })
       }
       return new Response('Bad Request: Missing Destination', { status: 400 })
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseServiceKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing')
        return new Response('Internal Server Error: Service Key missing', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let channelSecret = Deno.env.get('LINE_CHANNEL_SECRET')
    let channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')

    // Try DB lookup if destination exists
    let account = null
    if (destination) {
        const { data, error } = await supabase
            .from('line_accounts')
            .select('channel_secret, channel_access_token')
            .eq('line_user_id', destination)
            .maybeSingle()
        
        account = data
        
        if (error) {
            console.error('Database error:', error)
            return new Response(`Internal Server Error: Database lookup failed. ${error.message}`, { status: 500 })
        }

        if (account) {
            console.log('Found LINE account configuration for destination:', destination)
            channelSecret = account.channel_secret
            channelAccessToken = account.channel_access_token
        } else {
            console.warn('No LINE account found for destination:', destination, 'Using fallback env vars if available.')
            return new Response(`Internal Server Error: No account found for destination ${destination}`, { status: 500 })
        }
    }

    if (!channelSecret || !channelAccessToken) {
        console.error('Missing Channel Secret or Access Token')
        return new Response(`Internal Server Error: Configuration missing for destination ${destination}. Account found: ${!!account}`, { status: 500 })
    }

    // Verify Signature
    const isValid = await verifySignature(channelSecret, body, signature)
    if (!isValid) {
        console.error('Invalid Signature')
        return new Response('Forbidden: Invalid Signature', { status: 403 })
    }

    console.log('Signature verified successfully')

    // Process Events
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const replyToken = event.replyToken
        const text = event.message.text
        
        console.log(`Received message: ${text}`)

        // Echo back
        await replyMessage(channelAccessToken, replyToken, [{
          type: 'text',
          text: `You said: ${text}`
        }])
      }
    }

    return new Response(
      JSON.stringify({ message: 'OK' }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error('Error processing request:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})
