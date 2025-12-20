import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("LINE Webhook Function Initialized")

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    // TODO: Verify LINE Signature
    // const signature = req.headers.get('x-line-signature')
    // if (!signature) {
    //   return new Response('Bad Request', { status: 400 })
    // }

    const body = await req.json()
    console.log('Received event:', JSON.stringify(body, null, 2))

    const events = body.events || []

    // Process events
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        // TODO: Implement auto-response logic here
        // 1. Fetch auto-response rules from Supabase DB
        // 2. Match keyword
        // 3. Reply using LINE Messaging API
        console.log(`Received message: ${event.message.text}`)
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
