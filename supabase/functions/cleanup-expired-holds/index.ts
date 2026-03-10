import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'

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
      // 店舗のオーナーIDを取得
      const { data: store } = await supabaseClient
        .from('stores')
        .select('owner_id')
        .eq('id', storeId)
        .maybeSingle()

      if (!store?.owner_id) {
        console.log(`[Cleanup] Store not found: ${storeId}`)
        continue
      }

      // Google Calendar認証情報を取得（google_calendar_settingsテーブルから）
      const { data: calendarSettings } = await supabaseClient
        .from('google_calendar_settings')
        .select('refresh_token, calendar_id')
        .eq('user_id', store.owner_id)
        .maybeSingle()

      if (!calendarSettings?.refresh_token) {
        console.log(`[Cleanup] No Google Calendar credentials for store ${storeId}`)
        continue
      }

      const calendarId = calendarSettings.calendar_id || 'primary'

      // アクセストークンを取得
      let accessToken: string | null = null
      try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
            client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
            refresh_token: calendarSettings.refresh_token,
            grant_type: 'refresh_token',
          }),
        })

        const tokenData = await tokenResponse.json()
        if (tokenData.error) {
          console.error(`[Cleanup] Token refresh error for store ${storeId}:`, tokenData.error)
          continue
        }
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
          const deleted = await deleteGoogleEvent(accessToken, calendarId, hold.google_event_id)
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
    return safeErrorResponse(error, corsHeaders)
  }
})
