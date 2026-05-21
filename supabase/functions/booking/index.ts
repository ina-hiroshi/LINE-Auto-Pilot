import { createClient } from '@supabase/supabase-js'
import {
  decodeIdTokenAudience,
  getLineClientIdFromAccessTokenVerify,
  verifyLineIdToken,
  verifyLineToken,
} from '../_shared/line-auth.ts'
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
  handleCompletePayment,
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
      idToken,
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
      quoted_amount,
      paid_amount,
      is_manual
    } = await req.json()

    let line_user_id = requestLineUserId

    console.log('[Booking] Request:', { action, store_id, date, time })

    let verifiedUserId: string | null = null
    let isManualRegistration = false
    /** アクセストークンまたは ID トークンを送ったがいずれも検証できなかった */
    let loginCredentialRejected = false

    const hasLineAccessToken =
      typeof accessToken === 'string' && accessToken.length > 0
    const hasLineIdToken = typeof idToken === 'string' && idToken.length > 0

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

    if (!isManualRegistration) {
      if (hasLineAccessToken) {
        try {
          const profile = await verifyLineToken(accessToken as string)
          verifiedUserId = profile.userId
          line_user_id = verifiedUserId
          log.info('LINE access token verified', { userId: verifiedUserId })
        } catch (e) {
          loginCredentialRejected = true
          log.error('LINE access token verification failed', { action, err: String(e) })
        }
      }

      // ID トークン検証に渡す client_id の優先順（アクセストークンで未確定のときのみ使用）:
      // 1) アクセストークン検証 API が返す client_id（LIFF 発行元と必ず一致）
      // 2) ID トークン JWT の aud（Secret 未設定・誤設定でも動かしやすい）
      // 3) LINE_LOGIN_CHANNEL_ID（Supabase Secret）
      let clientIdForIdTokenVerify = ''
      if (!verifiedUserId && hasLineIdToken) {
        if (hasLineAccessToken) {
          const fromAccessVerify = await getLineClientIdFromAccessTokenVerify(accessToken as string)
          if (fromAccessVerify) {
            clientIdForIdTokenVerify = fromAccessVerify
            log.info('LINE client_id from access token verify', { clientId: fromAccessVerify })
          }
        }
        if (!clientIdForIdTokenVerify) {
          const fromJwt = decodeIdTokenAudience(idToken as string)
          if (fromJwt) {
            clientIdForIdTokenVerify = fromJwt
            log.info('LINE client_id from ID token aud claim')
          }
        }
        if (!clientIdForIdTokenVerify) {
          clientIdForIdTokenVerify = (Deno.env.get('LINE_LOGIN_CHANNEL_ID') ?? '').trim()
        }
      }

      if (!verifiedUserId && hasLineIdToken && clientIdForIdTokenVerify.length > 0) {
        try {
          const profile = await verifyLineIdToken(idToken as string, clientIdForIdTokenVerify)
          verifiedUserId = profile.userId
          line_user_id = verifiedUserId
          loginCredentialRejected = false
          log.info('LINE ID token verified', { userId: verifiedUserId })
        } catch (e) {
          loginCredentialRejected = true
          log.error('LINE ID token verification failed', { action, err: String(e) })
        }
      }
    }

    const publicActions = ['get_available_slots']
    const sensitiveActions = ['create_reservation', 'cancel_reservation', 'update_reservation', 'complete_payment', 'hold_slot', 'release_hold', 'check_customer', 'get_active_reservation']

    if (!publicActions.includes(action) && sensitiveActions.includes(action)) {
      if (!verifiedUserId && !isManualRegistration) {
        if (loginCredentialRejected) {
          throw new ClientVisibleError(
            'LINE の認証が期限切れか無効です。再度お試しください。',
            401,
          )
        }
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
      if (reservation_id) {
        const { data: modifyTarget } = await supabaseClient
          .from('reservations')
          .select('line_user_id, store_id, status')
          .eq('id', reservation_id)
          .maybeSingle()

        if (!modifyTarget || modifyTarget.store_id !== store_id || modifyTarget.status === 'cancelled') {
          throw new ClientVisibleError('変更対象の予約が見つかりません', 404)
        }

        // 空き枠表示: reservation_id が有効なら変更対象として除外（確定・仮押さえは別途本人確認）
        line_user_id = verifiedUserId ?? requestLineUserId ?? modifyTarget.line_user_id
      }
      return await handleGetAvailableSlots(supabaseClient, { ...params, line_user_id }, corsHeaders)
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
        quoted_amount: typeof quoted_amount === 'number' ? quoted_amount : undefined,
        isManualRegistration,
      }, corsHeaders)
    }

    if (action === 'complete_payment') {
      return await handleCompletePayment(supabaseClient, {
        reservation_id,
        store_id,
        paid_amount: typeof paid_amount === 'number' ? paid_amount : undefined,
        staff_id: staff_id ?? null,
        menu_id: menu_id ?? null,
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
