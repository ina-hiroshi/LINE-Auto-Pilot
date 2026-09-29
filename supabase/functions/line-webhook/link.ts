import type { SupabaseClientType } from '../_shared/types.ts'
import type { LinkKind } from '../_shared/link-code.ts'
import { buildReservationFlex, type FlexMessage } from '../_shared/reservation-flex.ts'

/**
 * 予約完了時に LIFF がお客様のトークへ送った「確認コード」を処理する。
 *
 * 1. コードを 1 回限りで消費する（店舗が一致し、期限内のものだけ）
 * 2. event.source.userId（Bot 側の ID）を、予約したお客様（LIFF 側の ID）に紐付ける
 * 3. 予約内容の Flex Message を、応答メッセージとして返す（配信数に数えられない）
 *
 * コードが無効でも、お客様の発言として自動応答や AI に回さない（呼び出し側で continue する）。
 */

export type HandleLinkCodeParams = {
  supabase: SupabaseClientType
  storeId: string
  /** Webhook の event.source.userId（Bot 側のユーザー ID） */
  messagingUserId: string
  code: string
  replyToken: string
  /** 応答メッセージの送信（LINE の reply API）。テストで差し替える。 */
  reply: (replyToken: string, messages: FlexMessage[]) => Promise<void>
  /** 有料プランのときだけ、店舗の予約ページのテーマを反映する（無料は simple 固定） */
  useStoreTheme: boolean
  /** 「予約の確認・変更」ボタンの LIFF ID。無ければボタンを出さない */
  liffId: string | null
}

export type HandleLinkCodeResult =
  | { status: 'invalid' }
  | { status: 'linked'; replied: boolean }

export async function handleLinkCode(params: HandleLinkCodeParams): Promise<HandleLinkCodeResult> {
  const { supabase, storeId, messagingUserId, code, replyToken, reply, useStoreTheme, liffId } = params

  // 1. コードを消費する。used_at is null の条件付き更新にして、同じコードの再送・再利用を防ぐ。
  const { data: token, error: claimError } = await supabase
    .from('line_messaging_link_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('code', code)
    .eq('store_id', storeId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('login_line_user_id, kind, reservation_id')
    .maybeSingle()

  if (claimError) {
    console.error('link token claim failed:', claimError.message)
    return { status: 'invalid' }
  }
  if (!token) return { status: 'invalid' }

  const loginUserId = token.login_line_user_id as string
  const kind = token.kind as LinkKind
  const reservationId = token.reservation_id as string | null

  // 2. 紐付け。Bot 側の ID は 1 人に 1 つなので、同じ店舗の別の顧客に付いていれば外してから付け直す。
  const { error: clearError } = await supabase
    .from('customers')
    .update({ line_messaging_user_id: null })
    .eq('store_id', storeId)
    .eq('line_messaging_user_id', messagingUserId)
    .neq('line_user_id', loginUserId)
  if (clearError) console.error('clear old messaging id failed:', clearError.message)

  const { error: linkError } = await supabase
    .from('customers')
    .update({ line_messaging_user_id: messagingUserId })
    .eq('store_id', storeId)
    .eq('line_user_id', loginUserId)
  if (linkError) console.error('link customer failed:', linkError.message)

  // 同じ体系の ID なら、紐付け前の顧客にも予約側の ID でそのまま配信できる。
  // 「同じ」は確定できる（別プロバイダーで ID が偶然一致することはない）ので常に true にできるが、
  // 「違う」は他人のコードが 1 件届いただけで店舗全体を false に落とさないよう、未判定のときだけ書く。
  await markIdsAligned(supabase, storeId, messagingUserId === loginUserId)

  // 友だちの記録（記録開始前から友だちだった人も、ここで残る）
  const { error: friendError } = await supabase.from('line_friends').upsert(
    {
      store_id: storeId,
      messaging_user_id: messagingUserId,
      status: 'following',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'store_id,messaging_user_id' },
  )
  if (friendError) console.error('upsert line_friends failed:', friendError.message)

  // 3. 予約内容を返信する。失敗しても紐付けは済んでいるので、そのまま成功として扱う。
  if (!reservationId) return { status: 'linked', replied: false }

  try {
    const message = await buildMessage({ supabase, storeId, reservationId, kind, useStoreTheme, liffId })
    if (!message) return { status: 'linked', replied: false }
    await reply(replyToken, [message])
    return { status: 'linked', replied: true }
  } catch (e) {
    console.error('reservation flex reply failed:', e instanceof Error ? e.message : e)
    return { status: 'linked', replied: false }
  }
}

async function buildMessage(params: {
  supabase: SupabaseClientType
  storeId: string
  reservationId: string
  kind: LinkKind
  useStoreTheme: boolean
  liffId: string | null
}): Promise<FlexMessage | null> {
  const { supabase, storeId, reservationId, kind, useStoreTheme, liffId } = params

  const { data: reservation } = await supabase
    .from('reservations')
    .select('start_time, end_time, memo, menu_id, staff_id')
    .eq('id', reservationId)
    .eq('store_id', storeId)
    .maybeSingle()
  if (!reservation) return null

  const { data: store } = await supabase
    .from('stores')
    .select('name, address, phone_number, liff_template_id, liff_theme_color, liff_logo_url')
    .eq('id', storeId)
    .maybeSingle()

  let menuName: string | null = null
  if (reservation.menu_id) {
    const { data: menu } = await supabase
      .from('booking_menus')
      .select('name')
      .eq('id', reservation.menu_id)
      .eq('store_id', storeId)
      .maybeSingle()
    menuName = menu?.name ?? null
  }

  let staffName: string | null = null
  if (reservation.staff_id) {
    const { data: staff } = await supabase
      .from('staff_members')
      .select('name')
      .eq('id', reservation.staff_id)
      .eq('store_id', storeId)
      .maybeSingle()
    staffName = staff?.name ?? null
  }

  return buildReservationFlex({
    kind,
    storeName: store?.name ?? '',
    logoUrl: useStoreTheme ? store?.liff_logo_url : null,
    templateId: useStoreTheme ? store?.liff_template_id : 'simple',
    themeColor: useStoreTheme ? store?.liff_theme_color : null,
    startTime: reservation.start_time,
    endTime: reservation.end_time,
    menuName,
    staffName,
    memo: reservation.memo,
    address: store?.address,
    phone: store?.phone_number,
    liffUrl: liffId ? `https://liff.line.me/${liffId}?store_id=${storeId}` : null,
  })
}

/** follow / unfollow イベントで友だちの状態を更新する。 */
export async function recordFriendEvent(
  supabase: SupabaseClientType,
  storeId: string,
  messagingUserId: string,
  status: 'following' | 'blocked',
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase.from('line_friends').upsert(
    {
      store_id: storeId,
      messaging_user_id: messagingUserId,
      status,
      ...(status === 'following' ? { followed_at: now } : {}),
      updated_at: now,
    },
    { onConflict: 'store_id,messaging_user_id' },
  )
  if (error) console.error('record friend event failed:', error.message)
}

/**
 * 店舗の LIFF 側 ID と Bot 側 ID が同じ体系かを記録する。
 * aligned=true は常に書く。aligned=false は未判定（null）のときだけ書く。
 */
async function markIdsAligned(supabase: SupabaseClientType, storeId: string, aligned: boolean): Promise<void> {
  let query = supabase.from('stores').update({ line_ids_aligned: aligned }).eq('id', storeId)
  if (!aligned) query = query.is('line_ids_aligned', null)
  const { error } = await query
  if (error) console.error('update line_ids_aligned failed:', error.message)
}

/**
 * Webhook の送信者 ID（Bot 側）が、この店舗の顧客の予約側 ID と一致するかを確かめる。
 * 一致するなら LIFF と Bot が同じプロバイダーなので、確認コードを待たずに
 * 紐付けと line_ids_aligned=true を確定できる（同じプロバイダーの店舗は、この経路だけで足りる）。
 */
export async function detectSameProviderCustomer(
  supabase: SupabaseClientType,
  storeId: string,
  messagingUserId: string,
): Promise<boolean> {
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, line_messaging_user_id')
    .eq('store_id', storeId)
    .eq('line_user_id', messagingUserId)
    .maybeSingle()
  if (error || !customer) return false

  if (customer.line_messaging_user_id !== messagingUserId) {
    const { error: updateError } = await supabase
      .from('customers')
      .update({ line_messaging_user_id: messagingUserId })
      .eq('id', customer.id)
    if (updateError) console.error('link same-provider customer failed:', updateError.message)
  }
  await markIdsAligned(supabase, storeId, true)
  return true
}
