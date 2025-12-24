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

// Helper to get user profile
async function getProfile(accessToken: string, userId: string): Promise<{ displayName: string, pictureUrl?: string } | null> {
  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    if (!response.ok) return null
    return await response.json()
  } catch (e) {
    console.error('Error fetching profile:', e)
    return null
  }
}

serve(async (req: Request) => {
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
    let storeId = null
    let isAiEnabled = false

    if (destination) {
        // Join with stores to get AI settings
        const { data, error } = await supabase
            .from('line_accounts')
            .select(`
                channel_secret, 
                channel_access_token,
                store_id,
                stores (
                    is_ai_enabled
                )
            `)
            .eq('line_user_id', destination)
            .maybeSingle()
        
        if (data) {
            console.log('Account data found:', JSON.stringify(data))
            account = data
            channelSecret = data.channel_secret
            channelAccessToken = data.channel_access_token
            storeId = data.store_id
            // @ts-ignore: Supabase join result type
            isAiEnabled = data.stores?.is_ai_enabled || false
        } else {
            console.log('No account data found for destination:', destination)
        }
        
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
            // Do not return error here, allow fallback to env vars
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
        const userId = event.source.userId
        
        console.log(`Received message: ${text} from ${userId}`)

        let replyText = null
        let status = 'manual_reply_needed'

        if (storeId) {
            console.log('Processing auto-response for storeId:', storeId)
            // 1. Get Auto Responses
            const { data: rules, error: rulesError } = await supabase
                .from('auto_responses')
                .select('*')
                .eq('store_id', storeId)
                .eq('is_active', true)
            
            if (rulesError) {
                console.error('Error fetching rules:', rulesError)
            } else {
                console.log(`Found ${rules?.length || 0} active rules`)
            }
            
            // 2. Scoring Logic
            let bestScore = 0
            let bestRule = null

            if (rules && rules.length > 0) {
                for (const rule of rules) {
                    let score = 0
                    
                    // Exact match (100 pts)
                    if (text === rule.keyword) {
                        score = 100
                    } 
                    // Main keyword match (30 pts)
                    else if (text.includes(rule.keyword)) {
                        score += 30
                    }

                    // Sub keywords match (10 pts each)
                    if (rule.sub_keywords && Array.isArray(rule.sub_keywords)) {
                        for (const sub of rule.sub_keywords) {
                            if (text.includes(sub)) {
                                score += 10
                            }
                        }
                    }
                    
                    console.log(`Rule "${rule.keyword}" score: ${score}`)

                    if (score > bestScore) {
                        bestScore = score
                        bestRule = rule
                    }
                }
            }
            
            console.log(`Best score: ${bestScore}`)

            // 3. Threshold Check (Threshold: 20)
            if (bestScore >= 20 && bestRule) {
                replyText = bestRule.response_text
                status = 'auto_replied'
                console.log('Selected auto-response rule:', bestRule.keyword)
            } else {
                // Fallback
                if (isAiEnabled) {
                    // TODO: Call OpenAI API
                    // For now, just a placeholder
                    // replyText = await callOpenAI(text, storeId)
                    replyText = "AIモードは現在準備中です。（AIが回答を生成する予定）"
                    status = 'ai_replied'
                    console.log('Fallback to AI')
                } else {
                    // Manual Reply Needed
                    replyText = "お問い合わせありがとうございます。\n担当者が確認次第、返信させていただきます。\n今しばらくお待ちください。"
                    status = 'manual_reply_needed'
                    console.log('Fallback to Manual Reply')
                }
            }

            // 4. Send Reply
            if (replyText) {
                console.log('Sending reply:', replyText)
                try {
                    await replyMessage(channelAccessToken, replyToken, [{
                        type: 'text',
                        text: replyText
                    }])
                    console.log('Reply sent successfully')
                } catch (e) {
                    console.error('Failed to send reply:', e)
                }
            }

            // 5. Save Log
            // Fetch profile for display name
            let displayName = null
            let pictureUrl = null
            if (channelAccessToken) {
                const profile = await getProfile(channelAccessToken, userId)
                if (profile) {
                    displayName = profile.displayName
                    pictureUrl = profile.pictureUrl
                }
            }

            const { error: logError } = await supabase.from('customer_logs').insert({
                store_id: storeId,
                line_user_id: userId,
                display_name: displayName,
                profile_picture_url: pictureUrl,
                message_content: text,
                reply_content: replyText,
                status: status
            })
            
            if (logError) {
                console.error('Error saving log:', logError)
            } else {
                console.log('Log saved successfully')
            }

        } else {
            console.warn('Store ID not found for this destination, skipping auto-response logic.')
        }
      }
    }

    return new Response(
      JSON.stringify({ message: 'OK' }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error: unknown) {
    console.error('Error processing request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})
