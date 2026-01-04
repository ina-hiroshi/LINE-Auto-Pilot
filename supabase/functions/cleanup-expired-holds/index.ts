import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Google Calendar Event削除関数
async function deleteGoogleEvent(accessToken: string, calendarId: string, eventId: string) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete Google event: ${response.status}`)
    }
    
    return true
  } catch (e) {
    console.error('Error deleting Google event:', e)
    return false
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('[Cleanup] Starting cleanup of expired holds at', new Date().toISOString())

    // 期限切れの仮予約を取得
    const { data: expiredHolds, error: fetchError } = await supabaseClient
      .from('temporary_holds')
      .select('id, store_id, google_event_id')
      .lt('expires_at', new Date().toISOString())

    if (fetchError) {
      console.error('[Cleanup] Error fetching expired holds:', fetchError)
      throw fetchError
    }

    if (!expiredHolds || expiredHolds.length === 0) {
      console.log('[Cleanup] No expired holds found')
      return new Response(JSON.stringify({ message: 'No expired holds', deleted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[Cleanup] Found ${expiredHolds.length} expired holds`)

    // 店舗ごとにGoogle Calendar認証情報を取得してイベント削除
    const storeIds = [...new Set(expiredHolds.map(h => h.store_id))]
    let deletedCount = 0

    for (const storeId of storeIds) {
      // Google Calendar認証情報を取得
      const { data: lineAccount } = await supabaseClient
        .from('line_accounts')
        .select('google_calendar_id, google_refresh_token')
        .eq('store_id', storeId)
        .maybeSingle()

      if (!lineAccount?.google_calendar_id || !lineAccount?.google_refresh_token) {
        console.log(`[Cleanup] No Google Calendar credentials for store ${storeId}`)
        continue
      }

      // アクセストークンを取得
      let accessToken: string | null = null
      try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
            client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
            refresh_token: lineAccount.google_refresh_token,
            grant_type: 'refresh_token',
          }),
        })

        const tokenData = await tokenResponse.json()
        if (tokenData.access_token) {
          accessToken = tokenData.access_token
        }
      } catch (e) {
        console.error(`[Cleanup] Failed to get access token for store ${storeId}:`, e)
        continue
      }

      if (!accessToken) continue

      // この店舗の期限切れ仮予約のGoogleイベントを削除
      const storeHolds = expiredHolds.filter(h => h.store_id === storeId && h.google_event_id)
      
      for (const hold of storeHolds) {
        if (hold.google_event_id) {
          const deleted = await deleteGoogleEvent(accessToken, lineAccount.google_calendar_id, hold.google_event_id)
          if (deleted) {
            console.log(`[Cleanup] Deleted Google event ${hold.google_event_id}`)
            deletedCount++
          }
        }
      }
    }

    // temporary_holdsテーブルから期限切れレコードを削除
    const { error: deleteError } = await supabaseClient
      .from('temporary_holds')
      .delete()
      .lt('expires_at', new Date().toISOString())

    if (deleteError) {
      console.error('[Cleanup] Error deleting expired holds from DB:', deleteError)
      throw deleteError
    }

    console.log(`[Cleanup] Cleanup completed. Deleted ${deletedCount} Google events and ${expiredHolds.length} DB records`)

    return new Response(
      JSON.stringify({ 
        message: 'Cleanup completed', 
        googleEventsDeleted: deletedCount,
        dbRecordsDeleted: expiredHolds.length 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    console.error('Cleanup Function Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
