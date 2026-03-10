// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { storeId } = await req.json()

    if (!storeId) {
      return new Response(
        JSON.stringify({ error: 'storeId is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // データベースからchannel_access_tokenを取得
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: lineAccount, error: dbError } = await supabase
      .from('line_accounts')
      .select('channel_access_token')
      .eq('store_id', storeId)
      .maybeSingle()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: `Database error: ${dbError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    if (!lineAccount) {
      console.error(`LINE account not found for storeId: ${storeId}`)
      return new Response(
        JSON.stringify({ error: 'LINE account not found. Please save LINE settings first.' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      )
    }

    if (!lineAccount.channel_access_token) {
      console.error(`Channel access token missing for storeId: ${storeId}`)
      return new Response(
        JSON.stringify({ error: 'Channel access token is missing. Please check your LINE settings.' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    const channelAccessToken = lineAccount.channel_access_token

    // LINE APIからBot情報を取得（userId = line_user_idを含む）
    const response = await fetch('https://api.line.me/v2/bot/info', {
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`LINE API Error: ${response.status} ${errorText}`)
    }

    const botInfo = await response.json()
    console.log('LINE Bot Info:', JSON.stringify(botInfo))
    
    // line_user_id (Bot User ID)、bot_id (Basic ID)、bot_picture_url をデータベースに保存
    const updateData: Record<string, string> = {}
    
    if (botInfo.userId) {
      updateData.line_user_id = botInfo.userId
    }
    
    if (botInfo.basicId) {
      updateData.bot_id = botInfo.basicId
    }
    
    if (botInfo.pictureUrl) {
      updateData.bot_picture_url = botInfo.pictureUrl
    }
    
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('line_accounts')
        .update(updateData)
        .eq('store_id', storeId)

      if (updateError) {
        console.error('Failed to update bot info:', updateError)
        // エラーでもBot情報は返す（既に設定されている可能性があるため）
      } else {
        console.log(`Updated bot info for store ${storeId}:`, updateData)
      }
    }

    return new Response(
      JSON.stringify(botInfo),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: unknown) {
    return safeErrorResponse(error, corsHeaders, 500, 'Internal server error')
  }
})
