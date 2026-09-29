// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'
import { requireStoreAccess } from '../_shared/store-access.ts'

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

    // 代行セットアップで管理者が他店舗に対して実行するため、
    // オーナー本人に加えて管理者も許可する。
    const access = await requireStoreAccess(req, storeId, supabase, corsHeaders)
    if (!access.ok) return access.response

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
      console.error(`LINE API Error: ${response.status} ${errorText}`)
      // トークン誤り（401）は利用者が直せるので、原因が分かる文言で返す
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({
            error: 'Channel Access Token が正しくありません。LINE Developers で発行した長期のチャネルアクセストークンを確認してください。',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
      throw new Error(`LINE API Error: ${response.status}`)
    }

    const botInfo = await response.json()
    
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
    
    if (updateData.line_user_id) {
      // 同じ公式アカウントが別の店舗に登録されていると、Webhook が店舗を特定できず
      // メッセージが無言で捨てられる。保存前に検出して知らせる。
      const { data: duplicates, error: dupError } = await supabase
        .from('line_accounts')
        .select('store_id')
        .eq('line_user_id', updateData.line_user_id)
        .neq('store_id', storeId)
        .limit(1)

      if (dupError) {
        throw new Error(`Duplicate check failed: ${dupError.message}`)
      }
      if (duplicates && duplicates.length > 0) {
        return new Response(
          JSON.stringify({
            error: 'この LINE 公式アカウントは、すでに別の店舗に登録されています。Channel Access Token を確認してください。',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
        )
      }
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('line_accounts')
        .update(updateData)
        .eq('store_id', storeId)

      if (updateError) {
        // 保存できていないのに成功を返すと、画面が「接続済み」と誤表示する
        console.error('Failed to update bot info:', updateError)
        return new Response(
          JSON.stringify({ error: 'Bot 情報の保存に失敗しました。もう一度お試しください。' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
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
