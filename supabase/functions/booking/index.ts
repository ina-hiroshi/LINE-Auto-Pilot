import { createClient } from '@supabase/supabase-js'
import { verifyLineToken } from '../_shared/line-auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { ClientVisibleError, clientVisibleErrorResponse, safeErrorResponse } from '../_shared/error-utils.ts'
import { createLogger } from '../_shared/logger.ts'

const log = createLogger('booking')
import { handleGetAvailableSlots } from './handlers/slots.ts'
import { handleCheckCustomer, handleGetActiveReservation } from './handlers/customer.ts'
import { handleHoldSlot, handleReleaseHold } from './handlers/hold.ts'
import {
  handleCreateReservation,
  handleCancelReservation,
  handleUpdateReservation,
} from './handlers/reservation.ts'

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

    const {
      accessToken,
      action,
      store_id,
      line_user_id: requestLineUserId,
      display_name,
      profile_picture_url,
      real_name,
      furigana,
      date,
      time,
      reservation_id,
      staff_id,
      menu_id,
      memo,
      is_manual
    } = await req.json()

    let line_user_id = requestLineUserId

    console.log('[Booking] Request:', { action, store_id, date, time })

    let verifiedUserId: string | null = null
    let isManualRegistration = false

    if (is_manual === true) {
      const authHeader = req.headers.get('authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error } = await supabaseClient.auth.getUser(token)
        if (!error && user) {
          const { data: store } = await supabaseClient
            .from('stores')
            .select('owner_id')
            .eq('id', store_id)
            .single()

          if (store?.owner_id === user.id) {
            isManualRegistration = true
          }
        }
      }
    }

    if (accessToken && !isManualRegistration) {
      try {
        const profile = await verifyLineToken(accessToken)
        verifiedUserId = profile.userId
        line_user_id = verifiedUserId
        console.log('[Booking] Token verified successfully, userId:', verifiedUserId)
      } catch (e) {
        console.error('Token verification failed:', e)
      }
    }

    const publicActions = ['get_available_slots']
    const sensitiveActions = ['create_reservation', 'cancel_reservation', 'update_reservation', 'hold_slot', 'release_hold', 'check_customer', 'get_active_reservation']

    if (!publicActions.includes(action) && sensitiveActions.includes(action)) {
      if (!verifiedUserId && !isManualRegistration) {
        throw new ClientVisibleError('この操作には LINE ログインが必要です', 401)
      }
    }

    console.log(`[Booking] Action: ${action}, User: ${line_user_id}, Name: ${display_name}, Pic: ${profile_picture_url ? 'Yes' : 'No'}`)

    const params = {
      store_id,
      line_user_id,
      date,
      time,
      reservation_id,
      staff_id,
      menu_id,
      memo,
      display_name,
      profile_picture_url,
      real_name,
      furigana,
    }

    if (action === 'check_customer') {
      return await handleCheckCustomer(supabaseClient, params, corsHeaders)
    }

    if (action === 'hold_slot') {
      return await handleHoldSlot(supabaseClient, params, corsHeaders)
    }

    if (action === 'release_hold') {
      return await handleReleaseHold(supabaseClient, params, corsHeaders)
    }

    if (action === 'get_available_slots') {
      return await handleGetAvailableSlots(supabaseClient, params, corsHeaders)
    }

    if (action === 'get_active_reservation') {
      return await handleGetActiveReservation(supabaseClient, params, corsHeaders)
    }

    if (action === 'cancel_reservation') {
      return await handleCancelReservation(supabaseClient, {
        ...params,
        isManualRegistration,
      }, corsHeaders)
    }

    if (action === 'update_reservation') {
      return await handleUpdateReservation(supabaseClient, {
        ...params,
        isManualRegistration,
      }, corsHeaders)
    }

    if (action === 'create_reservation') {
      return await handleCreateReservation(supabaseClient, {
        ...params,
        isManualRegistration,
      }, corsHeaders)
    }

    throw new ClientVisibleError('無効な操作です', 400)
  } catch (error: unknown) {
    if (error instanceof ClientVisibleError) {
      return clientVisibleErrorResponse(error, corsHeaders)
    }
    return safeErrorResponse(error, corsHeaders, 500, '予約処理に失敗しました')
  }
})
