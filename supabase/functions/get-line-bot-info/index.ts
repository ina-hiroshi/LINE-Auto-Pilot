import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { channel_token } = await req.json()

    if (!channel_token) {
      throw new Error('Channel token is required')
    }

    const response = await fetch('https://api.line.me/v2/bot/info', {
      headers: {
        Authorization: `Bearer ${channel_token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`LINE API Error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    
    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
