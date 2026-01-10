import { createClient } from '@supabase/supabase-js'
import { verifyLineToken } from '../_shared/line-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type BusinessHourSlot = { start: string; end: string }
type BusinessHoursByDay = Partial<Record<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', BusinessHourSlot[]>>

const parseBusinessHours = (businessHoursRaw: unknown, targetDate: string): BusinessHourSlot[] => {
  try {
    const parsed = (businessHoursRaw ?? {}) as BusinessHoursByDay
    const day = new Date(`${targetDate}T00:00:00`)
    const weekdayKey = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][day.getDay()] ?? 'mon') as keyof BusinessHoursByDay
    const slots = parsed?.[weekdayKey]
    if (!Array.isArray(slots)) return []
    return slots
      .map((s) => ({ start: s.start, end: s.end }))
      .filter((s) => !!s.start && !!s.end)
  } catch (_e) {
    return []
  }
}

// time は "HH:MM" または "HH:MM:SS" 形式を受け付ける
const toJstDate = (date: string, time: string) => {
  // 秒を含む場合は除去（HH:MM のみにする）
  const normalizedTime = time.slice(0, 5)
  return new Date(`${date}T${normalizedTime}:00+09:00`)
}

const isOverlapping = (startA: Date, endA: Date, startB: Date, endB: Date) => startA < endB && endA > startB

// --- Input Validation Helpers ---

/**
 * UUID形式の検証
 */
function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid) return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * 日付形式の検証 (YYYY-MM-DD)
 */
function isValidDate(date: string | null | undefined): boolean {
  if (!date) return false
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) return false
  
  const [year, month, day] = date.split('-').map(Number)
  const dateObj = new Date(year, month - 1, day)
  return dateObj.getFullYear() === year && 
         dateObj.getMonth() === month - 1 && 
         dateObj.getDate() === day
}

/**
 * 時間形式の検証 (HH:MM)
 */
function isValidTime(time: string | null | undefined): boolean {
  if (!time) return false
  const timeRegex = /^\d{2}:\d{2}$/
  if (!timeRegex.test(time)) return false
  
  const [hours, minutes] = time.split(':').map(Number)
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60
}

/**
 * 過去日付のチェック
 */
function isPastDate(date: string, time: string): boolean {
  const dateTime = new Date(`${date}T${time}:00+09:00`)
  const now = new Date()
  return dateTime < now
}

/**
 * 最大予約日数のチェック
 */
function isWithinMaxBookingDays(date: string, maxDays: number): boolean {
  const targetDate = new Date(`${date}T00:00:00+09:00`)
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + maxDays)
  return targetDate <= maxDate
}

// --- Reservation Creation Helpers ---

type CreateReservationParams = {
  supabaseClient: SupabaseClientType
  store_id: string
  line_user_id: string
  date: string
  time: string
  staff_id: string | null
  menu_id: string | null
  memo: string
  display_name?: string
  profile_picture_url?: string
  real_name?: string
  furigana?: string
  isManualRegistration: boolean
  excludeReservationId?: string // update_reservationの場合、古い予約IDを除外
}

/**
 * 予約作成の共通ロジック（容量チェック + RPC関数呼び出し）
 */
async function createReservationWithCapacityCheck(params: CreateReservationParams): Promise<string> {
  const {
    supabaseClient,
    store_id,
    line_user_id,
    date,
    time,
    staff_id,
    menu_id,
    memo,
    display_name,
    profile_picture_url,
    real_name,
    furigana,
    isManualRegistration,
    excludeReservationId
  } = params

  // 0. Get line_account_id
  const { data: lineAccount, error: laError } = await supabaseClient
    .from('line_accounts')
    .select('id')
    .eq('store_id', store_id)
    .maybeSingle()
  
  if (laError) throw laError
  if (!lineAccount) throw new Error('LINE Account not found for this store')

  // 1. Upsert Customer
  const { error: custError } = await supabaseClient
    .from('customers')
    .upsert({
      store_id,
      line_user_id,
      display_name,
      profile_picture_url,
      real_name,
      furigana,
    }, { onConflict: 'store_id, line_user_id' })

  if (custError) throw custError

  // 2. Calculate datetime
  const startDateTime = new Date(`${date}T${time}:00+09:00`)
  const storeSettings = await getStoreSettings(store_id)
  let durationMinutes = storeSettings?.slot_interval_minutes ?? 60
  
  if (menu_id) {
    const { data: menu } = await supabaseClient
      .from('booking_menus')
      .select('duration_minutes')
      .eq('id', menu_id)
      .maybeSingle()
    if (menu?.duration_minutes) durationMinutes = menu.duration_minutes
  }
  if (!durationMinutes || durationMinutes <= 0) durationMinutes = storeSettings?.slot_interval_minutes ?? 60

  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000)

  // 3. Get Google Calendar Client
  const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)

  // 4. Capacity Check with Staff Logic
  if (staff_id) {
    // 担当者指定あり → その担当者の枠のみチェック
    const capacityLimit = 1
    
    let overlapQuery = supabaseClient
      .from('reservations')
      .select('id')
      .eq('store_id', store_id)
      .eq('staff_id', staff_id)
      .neq('status', 'cancelled')
      .neq('status', 'temporary')
      .lt('start_time', endDateTime.toISOString())
      .gt('end_time', startDateTime.toISOString())
    
    if (excludeReservationId) {
      overlapQuery = overlapQuery.neq('id', excludeReservationId)
    }
    
    const { data: overlapReservations, error: overlapError } = await overlapQuery
    if (overlapError) throw overlapError
    
    // 仮押さえチェック
    const { data: conflictingHolds } = await supabaseClient
      .from('temporary_holds')
      .select('id, line_user_id')
      .eq('store_id', store_id)
      .eq('staff_id', staff_id)
      .gt('expires_at', new Date().toISOString())
      .lt('start_time', endDateTime.toISOString())
      .gt('end_time', startDateTime.toISOString())
    
    const otherUsersHold = (conflictingHolds || []).filter((h: { line_user_id?: string }) => h.line_user_id !== line_user_id)
    
    // Googleカレンダーチェック（そのスタッフの外部予約）
    let googleConflictCount = 0
    if (googleClient) {
      const { data: staffInfo } = await supabaseClient
        .from('staff_members')
        .select('id, name')
        .eq('id', staff_id)
        .maybeSingle()
      
      if (staffInfo) {
        const googleEvents = await listGoogleEvents(googleClient, startDateTime.toISOString(), endDateTime.toISOString())
        const staffGoogleEvents = googleEvents.filter(e => {
          if (!e.start?.dateTime || !e.end?.dateTime) return false
          const eventStart = new Date(e.start.dateTime)
          const eventEnd = new Date(e.end.dateTime)
          if (!isOverlapping(startDateTime, endDateTime, eventStart, eventEnd)) return false
          
          // 自分の仮予約は除外
          if (line_user_id && e.summary?.startsWith('【仮予約】')) {
            if (e.description && e.description.includes(line_user_id)) return false
          }
          
          const foundStaff = extractStaffFromGoogleEvent(e, [staffInfo])
          return foundStaff !== null
        })
        googleConflictCount = staffGoogleEvents.length
      }
    }
    
    if ((overlapReservations?.length ?? 0) + otherUsersHold.length + googleConflictCount >= capacityLimit) {
      throw new Error('この時間帯の予約枠が埋まっています')
    }
  } else {
    // 担当者指定なし → 対応可能スタッフ数を計算
    const workingStaff = await getWorkingStaffForTimeSlot(
      supabaseClient,
      store_id,
      date,
      startDateTime,
      endDateTime
    )
    
    if (workingStaff.length === 0) {
      throw new Error('この時間帯に対応可能なスタッフがいません')
    }
    
    // 内部予約で埋まっているスタッフID
    let overlapQuery = supabaseClient
      .from('reservations')
      .select('staff_id')
      .eq('store_id', store_id)
      .neq('status', 'cancelled')
      .neq('status', 'temporary')
      .lt('start_time', endDateTime.toISOString())
      .gt('end_time', startDateTime.toISOString())
    
    if (excludeReservationId) {
      overlapQuery = overlapQuery.neq('id', excludeReservationId)
    }
    
    const { data: overlapReservations, error: overlapError } = await overlapQuery
    if (overlapError) throw overlapError
    
    const internalBookedStaffIds = (overlapReservations || [])
      .map((r: { staff_id?: string }) => r.staff_id)
      .filter(Boolean) as string[]
    
    // 仮押さえで埋まっているスタッフID
    const { data: conflictingHolds } = await supabaseClient
      .from('temporary_holds')
      .select('staff_id')
      .eq('store_id', store_id)
      .gt('expires_at', new Date().toISOString())
      .lt('start_time', endDateTime.toISOString())
      .gt('end_time', startDateTime.toISOString())
    
    const holdBookedStaffIds = (conflictingHolds || [])
      .filter((h: { line_user_id?: string }) => h.line_user_id !== line_user_id)
      .map((h: { staff_id?: string }) => h.staff_id)
      .filter(Boolean) as string[]
    
    // Googleカレンダーで埋まっているスタッフ
    const { data: staffList } = await supabaseClient
      .from('staff_members')
      .select('id, name')
      .eq('store_id', store_id)
      .eq('is_active', true)
    
    let googleBookedStaffIds: string[] = []
    let unknownEventCount = 0
    
    if (googleClient && staffList) {
      // 自分の仮予約を除外
      const googleEvents = (await listGoogleEvents(googleClient, startDateTime.toISOString(), endDateTime.toISOString()))
        .filter(e => {
          if (line_user_id && e.summary?.startsWith('【仮予約】')) {
            if (e.description && e.description.includes(line_user_id)) return false
          }
          return true
        })
      
      const { identifiedStaffIds, unknownEventCount: unknown } = analyzeGoogleEventsForStaff(
        googleEvents,
        staffList,
        startDateTime,
        endDateTime
      )
      googleBookedStaffIds = identifiedStaffIds
      unknownEventCount = unknown
    }
    
    // 対応可能スタッフ数
    const bookedStaffSet = new Set([...internalBookedStaffIds, ...holdBookedStaffIds, ...googleBookedStaffIds])
    const availableStaffCount = workingStaff.length - bookedStaffSet.size - unknownEventCount
    
    if (availableStaffCount <= 0) {
      throw new Error('この時間帯の予約枠が埋まっています')
    }
  }

  // 5. Delete temporary holds
  const { data: userHolds } = await supabaseClient
    .from('temporary_holds')
    .select('google_event_id')
    .eq('store_id', store_id)
    .eq('line_user_id', line_user_id)
  
  if (googleClient && userHolds && userHolds.length > 0) {
    for (const hold of userHolds) {
      if (hold.google_event_id) {
        try {
          await deleteGoogleEvent(googleClient, hold.google_event_id)
          console.log(`[Booking] Deleted temporary Google event: ${hold.google_event_id}`)
        } catch (e) {
          console.error(`[Booking] Failed to delete temporary Google event ${hold.google_event_id}:`, e)
        }
      }
    }
  }

  await supabaseClient
    .from('temporary_holds')
    .delete()
    .eq('store_id', store_id)
    .eq('line_user_id', line_user_id)

  // 6. Create reservation using RPC function (race condition protection)
  const { data: reservationId, error: rpcError } = await supabaseClient.rpc('create_reservation_atomic', {
    p_store_id: store_id,
    p_line_account_id: lineAccount.id,
    p_line_user_id: line_user_id,
    p_start_time: startDateTime.toISOString(),
    p_end_time: endDateTime.toISOString(),
    p_staff_id: staff_id || null,
    p_menu_id: menu_id || null,
    p_memo: memo || '',
    p_registration_type: isManualRegistration ? 'manual' : 'line'
  })

  if (rpcError) {
    throw new Error(rpcError.message || '予約の作成に失敗しました')
  }

  if (!reservationId) {
    throw new Error('予約の作成に失敗しました')
  }

  return reservationId
}

/**
 * Googleカレンダーイベントを作成して予約に紐付け
 */
async function createGoogleCalendarEventForReservation(
  supabaseClient: SupabaseClientType,
  reservationId: string,
  store_id: string,
  startDateTime: Date,
  endDateTime: Date,
  staff_id: string | null,
  menu_id: string | null,
  real_name: string | undefined,
  display_name: string | undefined,
  line_user_id: string,
  memo: string
): Promise<void> {
  const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
  if (!googleClient) return

  try {
    // Fetch Staff Name
    let staffName = '指定なし'
    if (staff_id) {
      const { data: staff } = await supabaseClient
        .from('staff_members')
        .select('name')
        .eq('id', staff_id)
        .maybeSingle()
      if (staff) staffName = staff.name
    }

    // Fetch Menu Name
    let menuName = '指定なし'
    let menuPrice = ''
    if (menu_id) {
      const { data: menu } = await supabaseClient
        .from('booking_menus')
        .select('name, price')
        .eq('id', menu_id)
        .maybeSingle()
      if (menu) {
        menuName = menu.name
        if (menu.price) menuPrice = `(¥${menu.price.toLocaleString()})`
      }
    }

    const summary = `予約: ${real_name || display_name || 'LINE User'} 様`
    const description = `
■予約詳細
------------------
【お名前】 ${real_name || display_name || 'ゲスト'} 様
【担当】 ${staffName}
【メニュー】 ${menuName} ${menuPrice}
【メモ】
${memo || 'なし'}
------------------
LINE ID: ${line_user_id}
`.trim()

    const eventId = await createGoogleEvent(googleClient, {
      summary,
      description,
      start: { dateTime: startDateTime.toISOString() },
      end: { dateTime: endDateTime.toISOString() }
    })
    
    if (eventId) {
      await supabaseClient
        .from('reservations')
        .update({ google_event_id: eventId })
        .eq('id', reservationId)
    }
  } catch (gError) {
    console.error('Failed to create Google Calendar event:', gError)
  }
}

// --- Staff Helpers ---

type StaffInfo = { id: string; name: string }

/**
 * 指定時間帯に出勤しているスタッフを取得
 */
async function getWorkingStaffForTimeSlot(
  supabaseClient: SupabaseClientType,
  store_id: string,
  date: string,
  slotStart: Date,
  slotEnd: Date
): Promise<StaffInfo[]> {
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay()
  
  // 1. その店舗の全スタッフを取得
  const { data: allStaff } = await supabaseClient
    .from('staff_members')
    .select('id, name')
    .eq('store_id', store_id)
    .eq('is_active', true)
  
  if (!allStaff || allStaff.length === 0) return []
  
  // 2. その曜日の勤務パターンを取得
  const { data: workPatterns } = await supabaseClient
    .from('staff_work_patterns')
    .select('staff_id, start_time, end_time, slots, is_active')
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .in('staff_id', allStaff.map(s => s.id))
  
  // 3. 特別スケジュール（欠勤・時間変更）を取得
  const { data: specialSchedules } = await supabaseClient
    .from('staff_special_schedules')
    .select('staff_id, is_absent, override_start, override_end')
    .eq('date', date)
    .in('staff_id', allStaff.map(s => s.id))
  
  // 4. 該当時間帯に勤務しているスタッフをフィルタ
  const workingStaffIds = new Set<string>()
  
  for (const staff of allStaff) {
    const special = specialSchedules?.find(s => s.staff_id === staff.id)
    
    // 欠勤チェック
    if (special?.is_absent) continue
    
    const pattern = workPatterns?.find(p => p.staff_id === staff.id)
    if (!pattern) continue
    
    // 特別スケジュールで上書きされている場合
    if (special?.override_start && special?.override_end) {
      const workStart = toJstDate(date, special.override_start)
      const workEnd = toJstDate(date, special.override_end)
      if (isOverlapping(slotStart, slotEnd, workStart, workEnd)) {
        workingStaffIds.add(staff.id)
      }
      continue
    }
    
    // slotsカラム（JSONB）がある場合はそちらを優先
    if (pattern.slots && Array.isArray(pattern.slots) && pattern.slots.length > 0) {
      for (const slot of pattern.slots) {
        if (slot.start && slot.end) {
          const workStart = toJstDate(date, slot.start)
          const workEnd = toJstDate(date, slot.end)
          if (isOverlapping(slotStart, slotEnd, workStart, workEnd)) {
            workingStaffIds.add(staff.id)
            break
          }
        }
      }
      continue
    }
    
    // 旧形式（start_time/end_time）のフォールバック
    if (pattern.start_time && pattern.end_time) {
      const workStart = toJstDate(date, pattern.start_time)
      const workEnd = toJstDate(date, pattern.end_time)
      if (isOverlapping(slotStart, slotEnd, workStart, workEnd)) {
        workingStaffIds.add(staff.id)
      }
    }
  }
  
  // 5. スタッフ情報を返す
  return allStaff.filter(s => workingStaffIds.has(s.id))
}

/**
 * Googleカレンダーイベントから担当者名を検索
 */
function extractStaffFromGoogleEvent(
  event: { summary?: string; description?: string },
  staffList: StaffInfo[]
): StaffInfo | null {
  const searchText = `${event.summary || ''} ${event.description || ''}`.toLowerCase()
  
  for (const staff of staffList) {
    // スタッフ名で検索（部分一致）
    if (staff.name && searchText.includes(staff.name.toLowerCase())) {
      return staff
    }
  }
  return null // 担当者不明
}

/**
 * Googleカレンダーイベントを分析して、担当者が特定できたスタッフIDと不明イベント数を返す
 */
function analyzeGoogleEventsForStaff(
  googleEvents: { start?: { dateTime?: string }; end?: { dateTime?: string }; summary?: string; description?: string }[],
  staffList: StaffInfo[],
  slotStart: Date,
  slotEnd: Date
): { identifiedStaffIds: string[]; unknownEventCount: number } {
  const identifiedStaffIds: string[] = []
  let unknownEventCount = 0
  
  for (const event of googleEvents) {
    if (!event.start?.dateTime || !event.end?.dateTime) continue
    
    const eventStart = new Date(event.start.dateTime)
    const eventEnd = new Date(event.end.dateTime)
    
    if (!isOverlapping(slotStart, slotEnd, eventStart, eventEnd)) continue
    
    // 自分の仮予約は除外（既存ロジック）
    // ここでは担当者検索のみ実施
    
    const staff = extractStaffFromGoogleEvent(event, staffList)
    if (staff) {
      identifiedStaffIds.push(staff.id)
    } else {
      // 担当者不明 = 店舗全体の枠を消費
      unknownEventCount++
    }
  }
  
  return { identifiedStaffIds, unknownEventCount }
}

// --- Google Calendar Helpers ---

import type { SupabaseClientType } from '../_shared/types.ts'
async function getGoogleCalendarClient(supabaseClient: SupabaseClientType, store_id: string) {
  // 1. Get owner_id from store_id
  const { data: store } = await supabaseClient.from('stores').select('owner_id').eq('id', store_id).single()
  if (!store) return null

  // 2. Get settings
  const { data: settings } = await supabaseClient.from('google_calendar_settings').select('*').eq('user_id', store.owner_id).single()
  if (!settings || !settings.refresh_token) return null

  // 3. Refresh Token
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  
  if (!clientId || !clientSecret) {
    console.error('Missing Google Client ID/Secret')
    return null
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: settings.refresh_token,
        grant_type: 'refresh_token',
      }),
  })
  
  const tokens = await tokenResponse.json()
  if (tokens.error) {
    console.error('Google Token Refresh Error:', tokens)
    return null
  }

  return {
      accessToken: tokens.access_token,
      calendarId: settings.calendar_id || 'primary'
  }
}

async function listGoogleEvents(client: { accessToken: string; calendarId: string }, timeMin: string, timeMax: string) {
  try {
    // descriptionフィールドも取得するために明示的に指定（デフォルトでは含まれない場合がある）
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(client.calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${client.accessToken}` } }
    )
    const data = await response.json()
    console.log('[Booking] Google Calendar events fetched:', JSON.stringify(data.items?.map((e: { summary?: string; description?: string }) => ({ summary: e.summary, description: e.description })) || []))
    return data.items || []
  } catch (e) {
    console.error('Google List Events Error:', e)
    return []
  }
}

async function createGoogleEvent(client: { accessToken: string; calendarId: string }, eventData: Record<string, unknown>) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(client.calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      }
    )
    const data = await response.json()
    return data.id
  } catch (e) {
    console.error('Google Create Event Error:', e)
    return null
  }
}

async function deleteGoogleEvent(client: { accessToken: string; calendarId: string }, eventId: string) {
  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(client.calendarId)}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${client.accessToken}` }
      }
    )
  } catch (e) {
    console.error('Google Delete Event Error:', e)
  }
}

async function _updateGoogleEvent(client: { accessToken: string; calendarId: string }, eventId: string, eventData: Record<string, unknown>) {
  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(client.calendarId)}/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      }
    )
  } catch (e) {
    console.error('Google Update Event Error:', e)
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

    const { accessToken, action, store_id, line_user_id: requestLineUserId, display_name, profile_picture_url, real_name, furigana, date, time, reservation_id, staff_id, menu_id, memo, is_manual } = await req.json()
    // 再代入可能な変数として定義
    let line_user_id = requestLineUserId

    console.log('[Booking] Request:', { action, store_id, line_user_id, date, time, staff_id, menu_id })

    // --- Security: Verify Access Token ---
    let verifiedUserId: string | null = null;
    let isManualRegistration = false;

    // 管理画面からの手動登録の場合はSupabase Auth認証をチェック
    if (is_manual === true) {
      const authHeader = req.headers.get('authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error } = await supabaseClient.auth.getUser(token)
        if (!error && user) {
          // 店舗のオーナーか確認
          const { data: store } = await supabaseClient
            .from('stores')
            .select('owner_id')
            .eq('id', store_id)
            .single()
          
          if (store?.owner_id === user.id) {
            isManualRegistration = true
            // 手動登録の場合はリクエストのline_user_idをそのまま使用
          }
        }
      }
    }

    if (accessToken && !isManualRegistration) {
      try {
        // Fetch Channel ID if store_id is available
        let expectedChannelId: string | undefined;
        if (store_id) {
          const { data: lineAccount } = await supabaseClient
            .from('line_accounts')
            .select('channel_id')
            .eq('store_id', store_id)
            .maybeSingle()
          if (lineAccount?.channel_id) {
            expectedChannelId = lineAccount.channel_id
          }
        }

        const profile = await verifyLineToken(accessToken, expectedChannelId);
        verifiedUserId = profile.userId;
        // Securely overwrite the user ID with the verified one
        line_user_id = verifiedUserId;
        console.log('[Booking] Token verified successfully, userId:', verifiedUserId);
      } catch (e) {
        console.error('Token verification failed:', e);
        // accessTokenがあるが検証に失敗した場合でも、line_user_idがU始まりならLIFFからのアクセスと判断
        // LIFF SDKから取得したline_user_idは信頼できる
        if (line_user_id && line_user_id.startsWith('U')) {
          console.log('[Booking] Token verification failed but line_user_id looks valid, proceeding...');
          verifiedUserId = line_user_id;
        }
      }
    } else if (!isManualRegistration && line_user_id && line_user_id.startsWith('U')) {
      // accessTokenがなくてもline_user_idがU始まりならLIFFからのアクセスと判断
      console.log('[Booking] No accessToken but line_user_id looks valid, proceeding...');
      verifiedUserId = line_user_id;
    }

    // Enforce Authentication for sensitive actions (bypass for manual registration)
    // 全てのアクションでline_user_idの検証を必須（get_available_slotsは公開情報のため除外）
    const publicActions = ['get_available_slots']
    const sensitiveActions = ['create_reservation', 'cancel_reservation', 'update_reservation', 'hold_slot', 'release_hold', 'check_customer', 'get_active_reservation']
    
    if (!publicActions.includes(action) && sensitiveActions.includes(action)) {
      // line_user_idがUで始まる場合、またはアクセストークンで検証済みの場合のみ許可
      if (!verifiedUserId && !isManualRegistration) {
        if (!line_user_id || !line_user_id.startsWith('U')) {
          throw new Error('Unauthorized: Valid Access Token or valid line_user_id is required for this action')
        }
        // Uで始まる場合はLIFFからのアクセスと判断して許可
        verifiedUserId = line_user_id
      }
    }
    // -------------------------------------

    // Helper to fetch store settings only when needed
    const getStoreSettings = async (id: string) => {
      const { data, error } = await supabaseClient
        .from('stores')
        .select('slot_interval_minutes, capacity_per_slot, business_hours')
        .eq('id', id)
        .maybeSingle()
      
      if (error) throw error
      if (!data) throw new Error('Store not found')
      return data
    }

    console.log(`[Booking] Action: ${action}, User: ${line_user_id}, Name: ${display_name}, Pic: ${profile_picture_url ? 'Yes' : 'No'}`)

    if (action === 'check_customer') {
      const { data, error } = await supabaseClient
        .from('customers')
        .select('real_name, furigana, display_name')
        .eq('store_id', store_id)
        .eq('line_user_id', line_user_id)
        .maybeSingle()

      if (error) throw error
      return new Response(JSON.stringify({ customer: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 時間枠の仮押さえ
    if (action === 'hold_slot') {
      if (!store_id || !date || !time) throw new Error('store_id, date, and time are required')
      
      // 入力検証
      if (!isValidUUID(store_id)) throw new Error('Invalid store_id format')
      if (!isValidDate(date)) throw new Error('Invalid date format (expected YYYY-MM-DD)')
      if (!isValidTime(time)) throw new Error('Invalid time format (expected HH:MM)')
      if (staff_id && !isValidUUID(staff_id)) throw new Error('Invalid staff_id format')
      if (menu_id && !isValidUUID(menu_id)) throw new Error('Invalid menu_id format')
      
      const storeSettings = await getStoreSettings(store_id)
      if (isPastDate(date, time)) throw new Error('過去の日付は予約できません')
      const maxDays = storeSettings?.max_booking_days ?? 60
      if (!isWithinMaxBookingDays(date, maxDays)) {
        throw new Error(`予約可能日は${maxDays}日後までです`)
      }

      const storeSettings = await getStoreSettings(store_id)
      let durationMinutes = storeSettings?.slot_interval_minutes ?? 60
      let _menuCapacity: number | null = null // 将来の容量チェック用に保持

      // Menu-specific duration & capacity
      if (menu_id) {
        const { data: menu } = await supabaseClient
          .from('booking_menus')
          .select('duration_minutes, capacity_per_slot')
          .eq('id', menu_id)
          .maybeSingle()
        if (menu?.duration_minutes) durationMinutes = menu.duration_minutes
        if (typeof menu?.capacity_per_slot === 'number') _menuCapacity = menu.capacity_per_slot
      }
      if (!durationMinutes || durationMinutes <= 0) durationMinutes = storeSettings?.slot_interval_minutes ?? 60

      const startDateTime = new Date(`${date}T${time}:00+09:00`)
      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000)

      // このユーザーの既存の仮押さえを削除（新しい選択に置き換え）
      // Googleカレンダーからも削除
      const { data: existingHolds } = await supabaseClient
        .from('temporary_holds')
        .select('google_event_id')
        .eq('line_user_id', line_user_id)
        .eq('store_id', store_id)

      const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
      if (googleClient && existingHolds && existingHolds.length > 0) {
        for (const hold of existingHolds) {
          if (hold.google_event_id) {
            try {
              await deleteGoogleEvent(googleClient, hold.google_event_id)
              console.log(`[Booking] Deleted old temporary Google event: ${hold.google_event_id}`)
            } catch (e) {
              console.error('Failed to delete old temporary Google event:', e)
            }
          }
        }
      }

      await supabaseClient
        .from('temporary_holds')
        .delete()
        .eq('line_user_id', line_user_id)
        .eq('store_id', store_id)

      // Google Calendarに仮予約を作成
      let googleEventId: string | null = null
      if (googleClient) {
        try {
          const eventData = {
            summary: '【仮予約】' + (display_name || 'お客様'),
            description: `仮押さえ中\nユーザーID: ${line_user_id}`,
            start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Tokyo' },
            end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Tokyo' },
            colorId: '11', // 赤色で仮予約を強調
          }
          googleEventId = await createGoogleEvent(googleClient, eventData)
        } catch (e) {
          console.error('Failed to create temporary Google event:', e)
        }
      }

      // 仮押さえを作成（10分間有効）
      const { data: hold, error: holdError } = await supabaseClient
        .from('temporary_holds')
        .insert({
          store_id,
          line_user_id,
          staff_id: staff_id || null,
          menu_id: menu_id || null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10分後
          google_event_id: googleEventId,
        })
        .select()
        .single()

      if (holdError) throw holdError

      return new Response(JSON.stringify({ hold_id: hold.id, expires_at: hold.expires_at }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 仮押さえの解除
    if (action === 'release_hold') {
      // このユーザーの仮押さえを取得してGoogle Calendarからも削除
      const { data: holds } = await supabaseClient
        .from('temporary_holds')
        .select('*')
        .eq('line_user_id', line_user_id)
        .eq('store_id', store_id)

      if (holds && holds.length > 0) {
        const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
        for (const hold of holds) {
          if (hold.google_event_id && googleClient) {
            try {
              await deleteGoogleEvent(googleClient, hold.google_event_id)
            } catch (e) {
              console.error('Failed to delete temporary Google event:', e)
            }
          }
        }
      }

      // 仮押さえを削除
      await supabaseClient
        .from('temporary_holds')
        .delete()
        .eq('line_user_id', line_user_id)
        .eq('store_id', store_id)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'get_available_slots') {
      if (!store_id || !date) throw new Error('store_id and date are required')
      
      // 入力検証
      if (!isValidUUID(store_id)) throw new Error('Invalid store_id format')
      if (!isValidDate(date)) throw new Error('Invalid date format (expected YYYY-MM-DD)')
      if (staff_id && !isValidUUID(staff_id)) throw new Error('Invalid staff_id format')
      if (menu_id && !isValidUUID(menu_id)) throw new Error('Invalid menu_id format')
      
      // --- 期限切れの仮予約を削除（Google Calendarからも削除）---
      const { data: expiredHolds } = await supabaseClient
        .from('temporary_holds')
        .select('id, google_event_id, store_id')
        .lt('expires_at', new Date().toISOString())
      
      if (expiredHolds && expiredHolds.length > 0) {
        console.log(`[Booking] Found ${expiredHolds.length} expired holds to cleanup`)
        
        for (const hold of expiredHolds) {
          // Google Calendarイベントを削除
          if (hold.google_event_id) {
            const googleClient = await getGoogleCalendarClient(supabaseClient, hold.store_id)
            if (googleClient) {
              try {
                await deleteGoogleEvent(googleClient, hold.google_event_id)
                console.log(`[Booking] Deleted expired Google event: ${hold.google_event_id}`)
              } catch (e) {
                console.error('Failed to delete expired Google event:', e)
              }
            }
          }
        }
        
        // DBから期限切れの仮予約を削除
        await supabaseClient
          .from('temporary_holds')
          .delete()
          .lt('expires_at', new Date().toISOString())
        
        console.log('[Booking] Cleanup completed')
      }
      // -----------------------------------------------------------
      
      const storeSettings = await getStoreSettings(store_id)
      const slotInterval = storeSettings?.slot_interval_minutes ?? 60

      // --- 特別営業日/臨時休業日の確認 ---
      const { data: specialDate } = await supabaseClient
        .from('booking_special_dates')
        .select('is_closed, override_hours')
        .eq('store_id', store_id)
        .eq('date', date)
        .maybeSingle()
      
      // 臨時休業日の場合は空のスロットを返す
      if (specialDate?.is_closed) {
        return new Response(JSON.stringify({ slots: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      // -----------------------------------

      // Menu-specific duration & capacity override
      let durationMinutes = slotInterval
      let menuCapacity: number | null = null
      if (menu_id) {
        const { data: menu } = await supabaseClient
          .from('booking_menus')
          .select('duration_minutes, capacity_per_slot')
          .eq('id', menu_id)
          .maybeSingle()
        if (menu?.duration_minutes) durationMinutes = menu.duration_minutes
        if (typeof menu?.capacity_per_slot === 'number') menuCapacity = menu.capacity_per_slot
      }

      if (!durationMinutes || durationMinutes <= 0) {
        durationMinutes = slotInterval || 60
      }

      const dayStart = toJstDate(date, '00:00').toISOString()
      const dayEnd = toJstDate(date, '23:59').toISOString()

      // スタッフリストを取得（Googleカレンダーイベントの担当者検索用）
      const { data: staffList } = await supabaseClient
        .from('staff_members')
        .select('id, name')
        .eq('store_id', store_id)
        .eq('is_active', true)
      
      const staffInfoList: StaffInfo[] = staffList || []

      // 担当者指定がある場合は、その担当者の予約のみをチェック
      let query = supabaseClient
        .from('reservations')
        .select('start_time, end_time, status, line_user_id, staff_id')
        .eq('store_id', store_id)
        .neq('status', 'cancelled')
        .lt('start_time', dayEnd)
        .gt('end_time', dayStart)
      
      if (staff_id) {
        query = query.eq('staff_id', staff_id)
      }

      const { data: reservations, error } = await query

      if (error) throw error

      // --- 仮押さえのチェック（期限切れは除外） ---
      let holdQuery = supabaseClient
        .from('temporary_holds')
        .select('start_time, end_time, line_user_id, staff_id')
        .eq('store_id', store_id)
        .gt('expires_at', new Date().toISOString()) // 有効期限内のみ
        .lt('start_time', dayEnd)
        .gt('end_time', dayStart)
      
      if (staff_id) {
        holdQuery = holdQuery.eq('staff_id', staff_id)
      }

      const { data: holds } = await holdQuery
      // --------------------------------------------

      // --- Google Calendar Sync ---
      const googleClient = await getGoogleCalendarClient(supabaseClient, store_id)
      let googleEvents: { start: { dateTime?: string }; end: { dateTime?: string } }[] = []
      
      if (googleClient) {
        googleEvents = await listGoogleEvents(googleClient, dayStart, dayEnd)
      }
      // ----------------------------

      // --- スタッフ勤務時間の取得 ---
      let effectiveHours: BusinessHourSlot[] = []
      
      if (staff_id) {
        // スタッフ指定がある場合は、そのスタッフの勤務時間を使用
        const targetDate = new Date(`${date}T00:00:00`)
        const dayOfWeek = targetDate.getDay()
        
        // 基本勤務パターンを取得
        const { data: workPattern } = await supabaseClient
          .from('staff_work_patterns')
          .select('start_time, end_time, is_active')
          .eq('staff_id', staff_id)
          .eq('day_of_week', dayOfWeek)
          .maybeSingle()
        
        console.log(`[Booking] Staff ${staff_id} work pattern for day ${dayOfWeek}:`, workPattern)
        
        // 特別スケジュール（個別日程設定）を取得
        const { data: specialSchedule } = await supabaseClient
          .from('staff_special_schedules')
          .select('is_absent, override_start, override_end')
          .eq('staff_id', staff_id)
          .eq('date', date)
          .maybeSingle()
        
        console.log(`[Booking] Staff ${staff_id} special schedule for ${date}:`, specialSchedule)
        
        // 優先順位: 特別スケジュール > 基本勤務パターン
        if (specialSchedule) {
          if (specialSchedule.is_absent) {
            // 欠勤日は予約不可
            console.log(`[Booking] Staff ${staff_id} is absent on ${date}`)
            effectiveHours = []
          } else if (specialSchedule.override_start && specialSchedule.override_end) {
            // 個別日程設定がある場合
            effectiveHours = [{ start: specialSchedule.override_start, end: specialSchedule.override_end }]
          } else {
            // 基本勤務パターンにフォールバック
            if (workPattern?.is_active && workPattern.start_time && workPattern.end_time) {
              effectiveHours = [{ start: workPattern.start_time, end: workPattern.end_time }]
            } else {
              effectiveHours = []
            }
          }
        } else if (workPattern?.is_active) {
          // 基本勤務パターンを使用 (start_time/end_time を使用)
          if (workPattern.start_time && workPattern.end_time) {
            effectiveHours = [{ start: workPattern.start_time, end: workPattern.end_time }]
          } else {
            effectiveHours = []
          }
        }
        // workPattern が null (未登録) の場合は effectiveHours = [] のまま
        
        console.log(`[Booking] Staff ${staff_id} effective hours:`, effectiveHours)
        
        // スタッフの勤務時間がない場合は予約不可
        if (effectiveHours.length === 0) {
          console.log(`[Booking] No available slots for staff ${staff_id} on ${date}`)
          return new Response(JSON.stringify({ slots: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } else {
        // スタッフ指定がない場合は店舗営業時間を使用
        // 特別営業日の営業時間上書きがある場合はそちらを優先
        if (specialDate?.override_hours && Array.isArray(specialDate.override_hours) && specialDate.override_hours.length > 0) {
          effectiveHours = specialDate.override_hours
        } else if (storeSettings?.business_hours) {
          effectiveHours = parseBusinessHours(storeSettings.business_hours, date)
        } else {
          effectiveHours = [{ start: '10:00', end: '20:00' }]
        }
      }
      // ----------------------------

      const slots: { time: string; available: boolean }[] = []

      for (const hourRange of effectiveHours) {
        const rangeStart = toJstDate(date, hourRange.start)
        const rangeEnd = toJstDate(date, hourRange.end)

        for (let cursor = new Date(rangeStart); cursor < rangeEnd; cursor = new Date(cursor.getTime() + slotInterval * 60000)) {
          const slotEnd = new Date(cursor.getTime() + durationMinutes * 60000)
          if (slotEnd > rangeEnd) continue

          // Check Internal Reservations (自分の仮予約は除外)
          const internalOverlapCount = (reservations || []).filter((r: { status: string; line_user_id: string; start_time: string; end_time: string }) => {
            // 自分の仮予約は除外（他人の確定予約やキャンセルされていない予約のみカウント）
            if (r.status === 'temporary' && r.line_user_id === line_user_id) return false
            const resStart = new Date(r.start_time)
            const resEnd = new Date(r.end_time)
            return isOverlapping(cursor, slotEnd, resStart, resEnd)
          }).length

          // Check Temporary Holds (自分の仮押さえは除外)
          const holdOverlapCount = (holds || []).filter((h: { line_user_id: string; start_time: string; end_time: string }) => {
            if (h.line_user_id === line_user_id) return false // 自分の仮押さえは除外
            const holdStart = new Date(h.start_time)
            const holdEnd = new Date(h.end_time)
            return isOverlapping(cursor, slotEnd, holdStart, holdEnd)
          }).length

          // Check Google Calendar Events (自分の仮予約のみ除外)
          type GoogleEvent = { start?: { dateTime?: string }; end?: { dateTime?: string }; summary?: string; description?: string }
          
          // 自分の仮予約を除外したGoogleイベント
          const relevantGoogleEvents = googleEvents.filter((e: GoogleEvent) => {
            if (!e.start?.dateTime || !e.end?.dateTime) return false
            
            // 仮予約イベントで、自分のline_user_idが含まれている場合は除外
            if (line_user_id && e.summary?.startsWith('【仮予約】')) {
              if (e.description && e.description.includes(line_user_id)) {
                console.log(`[Booking] Excluding own temporary event: ${e.summary}`)
                return false
              }
            }
            
            const resStart = new Date(e.start.dateTime)
            const resEnd = new Date(e.end.dateTime)
            return isOverlapping(cursor, slotEnd, resStart, resEnd)
          })
          
          // 枠計算ロジック
          let capacityLimit: number
          let totalOverlap: number
          
          if (staff_id) {
            // 担当者指定あり → その担当者の枠のみチェック（capacity = 1）
            capacityLimit = 1
            
            // 内部予約でそのスタッフが埋まっているか
            const staffReservationCount = internalOverlapCount
            
            // 仮押さえでそのスタッフが埋まっているか
            const staffHoldCount = holdOverlapCount
            
            // Googleカレンダーでそのスタッフが埋まっているか
            const staffInfo = staffInfoList.find(s => s.id === staff_id)
            const staffGoogleEvents = staffInfo
              ? relevantGoogleEvents.filter(e => {
                  const foundStaff = extractStaffFromGoogleEvent(e, [staffInfo])
                  return foundStaff !== null
                })
              : []
            
            totalOverlap = staffReservationCount + staffHoldCount + staffGoogleEvents.length
          } else {
            // 担当者指定なし → 対応可能スタッフ数を計算
            const workingStaff = await getWorkingStaffForTimeSlot(
              supabaseClient,
              store_id,
              date,
              cursor,
              slotEnd
            )
            
            if (workingStaff.length === 0) {
              // 出勤スタッフがいない場合は予約不可
              slots.push({ time: `${hh}:${mm}`, available: false })
              continue
            }
            
            // 内部予約で埋まっているスタッフID
            const internalBookedStaffIds = (reservations || [])
              .filter((r: { status: string; line_user_id: string; start_time: string; end_time: string; staff_id?: string }) => {
                if (r.status === 'temporary' && r.line_user_id === line_user_id) return false
                const resStart = new Date(r.start_time)
                const resEnd = new Date(r.end_time)
                return isOverlapping(cursor, slotEnd, resStart, resEnd) && r.staff_id
              })
              .map((r: { staff_id?: string }) => r.staff_id)
              .filter(Boolean) as string[]
            
            // 仮押さえで埋まっているスタッフID
            const holdBookedStaffIds = (holds || [])
              .filter((h: { line_user_id: string; start_time: string; end_time: string; staff_id?: string }) => {
                if (h.line_user_id === line_user_id) return false
                const holdStart = new Date(h.start_time)
                const holdEnd = new Date(h.end_time)
                return isOverlapping(cursor, slotEnd, holdStart, holdEnd) && h.staff_id
              })
              .map((h: { staff_id?: string }) => h.staff_id)
              .filter(Boolean) as string[]
            
            // Googleカレンダーで埋まっているスタッフ
            const { identifiedStaffIds, unknownEventCount } = analyzeGoogleEventsForStaff(
              relevantGoogleEvents,
              staffInfoList,
              cursor,
              slotEnd
            )
            
            // 対応可能スタッフ数 = 出勤数 - 予約済み - 担当者不明イベント数
            const bookedStaffSet = new Set([...internalBookedStaffIds, ...holdBookedStaffIds, ...identifiedStaffIds])
            const availableStaffCount = workingStaff.length - bookedStaffSet.size - unknownEventCount
            
            capacityLimit = Math.max(0, availableStaffCount)
            totalOverlap = 0 // 既にcapacityLimitに反映済み
          }
          
          const available = totalOverlap < capacityLimit
          
          // Convert to JST time string for display
          // cursor is already in JST timezone (created with +09:00)
          // Extract hours and minutes directly
          const hh = cursor.getHours().toString().padStart(2, '0')
          const mm = cursor.getMinutes().toString().padStart(2, '0')
          slots.push({ time: `${hh}:${mm}`, available })
        }
      }

      return new Response(JSON.stringify({ slots }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'get_active_reservation') {
      const now = new Date().toISOString()
      const { data, error } = await supabaseClient
        .from('reservations')
        .select('*, staff:staff_members(name), menu:booking_menus(name, price)')
        .eq('store_id', store_id)
        .eq('line_user_id', line_user_id)
        .neq('status', 'cancelled')
        .gte('start_time', now)
        .order('start_time', { ascending: true })
        // .limit(1) // 複数予約に対応するためlimitを削除

      if (error) throw error
      return new Response(JSON.stringify({ reservations: data }), { // reservation -> reservations (Array)
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'cancel_reservation') {
        if (!reservation_id) throw new Error('Reservation ID is required')
        if (!isValidUUID(reservation_id)) throw new Error('Invalid reservation_id format')
        console.log(`[Booking] Cancelling reservation: ${reservation_id}`)

        // Fetch reservation to get google_event_id
        const { data: reservation, error: fetchError } = await supabaseClient
            .from('reservations')
            .select('google_event_id, store_id, line_user_id')
            .eq('id', reservation_id)
            .single()
        
        if (fetchError) throw fetchError

        // 管理画面からの操作（オーナー認証済み）か、自分の予約かをチェック
        if (!isManualRegistration && reservation.line_user_id !== line_user_id) {
          throw new Error('Unauthorized: You can only cancel your own reservations')
        }

        const { error } = await supabaseClient
            .from('reservations')
            .update({ status: 'cancelled' })
            .eq('id', reservation_id)
        
        if (error) throw error

        // --- Google Calendar Delete Event ---
        if (reservation?.google_event_id) {
            const googleClient = await getGoogleCalendarClient(supabaseClient, reservation.store_id)
            if (googleClient) {
                try {
                    await deleteGoogleEvent(googleClient, reservation.google_event_id)
                } catch (gError) {
                    console.error('Failed to delete Google Calendar event:', gError)
                }
            }
        }
        // ------------------------------------

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    if (action === 'update_reservation') {
      // 入力検証
      if (!reservation_id) throw new Error('reservation_id is required')
      if (!store_id || !date || !time) throw new Error('store_id, date, and time are required')
      if (!isValidUUID(reservation_id)) throw new Error('Invalid reservation_id format')
      if (!isValidUUID(store_id)) throw new Error('Invalid store_id format')
      if (!isValidDate(date)) throw new Error('Invalid date format (expected YYYY-MM-DD)')
      if (!isValidTime(time)) throw new Error('Invalid time format (expected HH:MM)')
      if (staff_id && !isValidUUID(staff_id)) throw new Error('Invalid staff_id format')
      if (menu_id && !isValidUUID(menu_id)) throw new Error('Invalid menu_id format')
      
      // 1. Cancel old reservation
      // Fetch old reservation to get google_event_id
      const { data: oldReservation, error: fetchError } = await supabaseClient
          .from('reservations')
          .select('google_event_id, store_id, line_user_id')
          .eq('id', reservation_id)
          .single()
      
      if (fetchError) throw fetchError

      // 管理画面からの操作（オーナー認証済み）か、自分の予約かをチェック
      if (!isManualRegistration && oldReservation.line_user_id !== line_user_id) {
        throw new Error('Unauthorized: You can only update your own reservations')
      }
      
      // 日付検証（過去日付・最大予約日数）
      const storeSettings = await getStoreSettings(store_id)
      if (isPastDate(date, time)) throw new Error('過去の日付は予約できません')
      const maxDays = storeSettings?.max_booking_days ?? 60
      if (!isWithinMaxBookingDays(date, maxDays)) {
        throw new Error(`予約可能日は${maxDays}日後までです`)
      }

      const { error: cancelError } = await supabaseClient
          .from('reservations')
          .update({ status: 'cancelled' })
          .eq('id', reservation_id)
      
      if (cancelError) throw cancelError

      // --- Google Calendar Delete Old Event ---
      if (oldReservation?.google_event_id) {
          const googleClient = await getGoogleCalendarClient(supabaseClient, oldReservation.store_id)
          if (googleClient) {
              try {
                  await deleteGoogleEvent(googleClient, oldReservation.google_event_id)
              } catch (gError) {
                  console.error('Failed to delete old Google Calendar event:', gError)
              }
          }
      }
      // ----------------------------------------

      // 2. Create new reservation using common function
      const startDateTime = new Date(`${date}T${time}:00+09:00`)
      const storeSettings = await getStoreSettings(store_id)
      let durationMinutes = storeSettings?.slot_interval_minutes ?? 60
      if (menu_id) {
        const { data: menu } = await supabaseClient
          .from('booking_menus')
          .select('duration_minutes')
          .eq('id', menu_id)
          .maybeSingle()
        if (menu?.duration_minutes) durationMinutes = menu.duration_minutes
      }
      if (!durationMinutes || durationMinutes <= 0) durationMinutes = storeSettings?.slot_interval_minutes ?? 60
      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000)

      const reservationId = await createReservationWithCapacityCheck({
        supabaseClient,
        store_id,
        line_user_id,
        date,
        time,
        staff_id: staff_id || null,
        menu_id: menu_id || null,
        memo: memo || '',
        display_name,
        profile_picture_url,
        real_name,
        furigana,
        isManualRegistration,
        excludeReservationId: reservation_id // 古い予約を除外
      })

      // 作成された予約を取得
      const { data: newReservation, error: fetchError } = await supabaseClient
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single()

      if (fetchError) throw fetchError

      // Delete temporary reservation (hold_slot) for this user
      await supabaseClient
        .from('reservations')
        .delete()
        .eq('store_id', store_id)
        .eq('line_user_id', line_user_id)
        .eq('status', 'temporary')

      // Create Google Calendar Event
      await createGoogleCalendarEventForReservation(
        supabaseClient,
        reservationId,
        store_id,
        startDateTime,
        endDateTime,
        staff_id || null,
        menu_id || null,
        real_name,
        display_name,
        line_user_id,
        memo || ''
      )

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'create_reservation') {
      // 入力検証
      if (!store_id || !date || !time) throw new Error('store_id, date, and time are required')
      if (!isValidUUID(store_id)) throw new Error('Invalid store_id format')
      if (!isValidDate(date)) throw new Error('Invalid date format (expected YYYY-MM-DD)')
      if (!isValidTime(time)) throw new Error('Invalid time format (expected HH:MM)')
      if (staff_id && !isValidUUID(staff_id)) throw new Error('Invalid staff_id format')
      if (menu_id && !isValidUUID(menu_id)) throw new Error('Invalid menu_id format')
      
      // 0. Get line_account_id
      const { data: lineAccount, error: laError } = await supabaseClient
        .from('line_accounts')
        .select('id')
        .eq('store_id', store_id)
        .maybeSingle()
      
      if (laError) throw laError
      if (!lineAccount) throw new Error('LINE Account not found for this store')
      
      // 日付検証（過去日付・最大予約日数）
      const storeSettings = await getStoreSettings(store_id)
      if (isPastDate(date, time)) throw new Error('過去の日付は予約できません')
      const maxDays = storeSettings?.max_booking_days ?? 60
      if (!isWithinMaxBookingDays(date, maxDays)) {
        throw new Error(`予約可能日は${maxDays}日後までです`)
      }

      // Create reservation using common function
      const startDateTime = new Date(`${date}T${time}:00+09:00`)
      let durationMinutes = storeSettings?.slot_interval_minutes ?? 60
      if (menu_id) {
        const { data: menu } = await supabaseClient
          .from('booking_menus')
          .select('duration_minutes')
          .eq('id', menu_id)
          .maybeSingle()
        if (menu?.duration_minutes) durationMinutes = menu.duration_minutes
      }
      if (!durationMinutes || durationMinutes <= 0) durationMinutes = storeSettings?.slot_interval_minutes ?? 60
      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000)

      const reservationId = await createReservationWithCapacityCheck({
        supabaseClient,
        store_id,
        line_user_id,
        date,
        time,
        staff_id: staff_id || null,
        menu_id: menu_id || null,
        memo: memo || '',
        display_name,
        profile_picture_url,
        real_name,
        furigana,
        isManualRegistration
      })

      // 作成された予約を取得
      const { data: newReservation, error: fetchError } = await supabaseClient
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single()

      if (fetchError) throw fetchError

      // Delete temporary reservation (hold_slot) for this user
      await supabaseClient
        .from('reservations')
        .delete()
        .eq('store_id', store_id)
        .eq('line_user_id', line_user_id)
        .eq('status', 'temporary')

      // Create Google Calendar Event
      await createGoogleCalendarEventForReservation(
        supabaseClient,
        reservationId,
        store_id,
        startDateTime,
        endDateTime,
        staff_id || null,
        menu_id || null,
        real_name,
        display_name,
        line_user_id,
        memo || ''
      )

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Invalid action')

  } catch (error: unknown) {
    console.error('Booking Function Error:', error)
    const errorMessage = error instanceof Error
      ? error.message
      : (error as { message?: string })?.message ?? 'Unknown error'

    // エラー内容に応じたステータスコードを返す
    const isAuthError = errorMessage.toLowerCase().includes('unauthorized')
    const isNotFoundError = errorMessage.toLowerCase().includes('not found')
    const statusCode = isAuthError ? 401 : isNotFoundError ? 404 : 400

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode,
    })
  }
})
