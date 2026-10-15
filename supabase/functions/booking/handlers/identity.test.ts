import { assertEquals, assertRejects } from 'jsr:@std/assert@^1.0.0'
import { createFakeSupabase } from './testSupabase.ts'
import { handleHoldSlot } from './hold.ts'
import { handleGetAvailableSlots } from './slots.ts'
import { resolveQuotedAmount } from './reservation.ts'
import { deleteGoogleEvent } from './google-calendar.ts'
import { ClientVisibleError } from '../../_shared/error-utils.ts'

const STORE = '11111111-1111-4111-8111-111111111111'
const RESERVATION = '44444444-4444-4444-8444-444444444444'
const CORS = { 'Access-Control-Allow-Origin': '*' }
const date = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10)

function setup() {
  return createFakeSupabase((q) => {
    if (q.table === 'reservations') return { data: {
      id: RESERVATION, store_id: STORE, line_user_id: 'U-victim',
      status: 'confirmed', staff_id: null, google_event_id: null,
      start_time: `${date()}T01:00:00Z`, end_time: `${date()}T02:00:00Z`,
    }, error: null }
    if (q.table === 'stores') return { data: {
      capacity_per_slot: 2, max_booking_days: 60, booking_enable_staff: false,
      slot_interval_minutes: 60,
    }, error: null }
    if (q.table === 'booking_menus') return { data: { price: 5000 }, error: null }
    if (q.method === 'insert') return { data: { id: 'hold', expires_at: 'later' }, error: null }
    return { data: [], error: null }
  })
}

for (const verifiedUserId of [undefined, 'U-attacker']) {
  for (const handler of [handleHoldSlot, handleGetAvailableSlots]) {
    Deno.test(`${handler.name}: 他人のIDを指定しても予約変更を拒否 (${verifiedUserId})`, async () => {
      const fake = setup()
      const error = await assertRejects(() => handler(fake.client, {
        store_id: STORE, reservation_id: RESERVATION, line_user_id: 'U-victim',
        verifiedUserId, date: date(), time: '11:00',
      }, CORS), ClientVisibleError)
      assertEquals(error.statusCode, 403)
      assertEquals(fake.find('temporary_holds').length, 0)
      assertEquals(fake.find('temporary_holds', 'delete').length, 0)
      assertEquals(fake.find('temporary_holds', 'insert').length, 0)
    })
  }
}

for (const auth of [{ verifiedUserId: 'U-victim' }, { isManualRegistration: true }]) {
  Deno.test(`仮押さえ: 本人と認可済み管理者は変更できる ${JSON.stringify(auth)}`, async () => {
    // 重複照会には配列、変更対象照会には予約を返す。
    const client = createFakeSupabase((q) => {
      if (q.table === 'reservations' && !q.cardinality) return { data: [], error: null }
      if (q.table === 'reservations') return { data: {
        id: RESERVATION, store_id: STORE, line_user_id: 'U-victim', status: 'confirmed',
        staff_id: null, google_event_id: null, start_time: `${date()}T01:00:00Z`, end_time: `${date()}T02:00:00Z`,
      }, error: null }
      if (q.table === 'stores') return { data: { capacity_per_slot: 2, max_booking_days: 60, booking_enable_staff: false }, error: null }
      if (q.method === 'insert') return { data: { id: 'hold', expires_at: 'later' }, error: null }
      return { data: [], error: null }
    })
    const res = await handleHoldSlot(client.client, {
      store_id: STORE, reservation_id: RESERVATION, date: date(), time: '11:00', ...auth,
    }, CORS)
    assertEquals(res.status, 200)
    assertEquals((client.find('temporary_holds', 'insert')[0].payload as Record<string, unknown>).line_user_id, 'U-victim')
  })
}

Deno.test('見積金額: 一般顧客の金額指定を無視し管理者だけ上書きできる', async () => {
  const { client } = setup()
  assertEquals(await resolveQuotedAmount(client, 'menu', 1, false), 5000)
  assertEquals(await resolveQuotedAmount(client, null, 1, false), null)
  assertEquals(await resolveQuotedAmount(client, 'menu', 1234, true), 1234)
  assertEquals(await resolveQuotedAmount(client, 'menu', Infinity, true), 5000)
})

Deno.test('Googleイベント削除: パス操作・クエリ・ドットを拒否し通信しない', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = () => { calls++; throw new Error('Unexpected fetch') }
  try {
    for (const eventId of [
      '../calendars/primary', '..', 'abcde/12345', 'abcde?x=1', 'abcde#x', '%2e%2e',
      '', 'abcd', 'a'.repeat(1025), 'ABCDE', 'abcw0',
      `${'a'.repeat(1025)}_20261015`, 'abcd_20261015T090000Z',
      'abcde_20261015T09000Z',
      'abcde_20261015T090000', 'abcde_20261015t090000z',
      'abcde\n', 'abcde\r', 'abcde_20261015T090000Z/../',
    ]) {
      await assertRejects(() => deleteGoogleEvent({ accessToken: 'unused', calendarId: 'primary' }, eventId), Error, 'Invalid Google event ID')
    }
    assertEquals(calls, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('Googleイベント削除: 基本IDと繰り返し予定の各回のIDを許可する', async () => {
  const originalFetch = globalThis.fetch
  const calls: { url: string; method?: string; authorization: string | null }[] = []
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method, authorization: new Headers(init?.headers).get('Authorization') })
    return Promise.resolve(new Response(null, { status: 204 }))
  }
  try {
    const eventIds = [
      'abcde', '0123456789abcdefghijklmnopqrstuv', 'a'.repeat(1024),
      'ab_cd', '_abcdefg', 'abcde_', '_____',
      'abcd_20261015', 'abcde_2026101', 'abcde_202610150',
      'abcde_20261015_20261016',
      'abcde_20261015', 'abcde_20261015T090000Z',
      'ab_cd_20261015T090000Z', '_abcdefg_20261015T090000Z',
      `${'a'.repeat(1024)}_20261015`, `${'a'.repeat(1024)}_20261015T090000Z`,
    ]
    for (const eventId of eventIds) {
      await deleteGoogleEvent({ accessToken: 'test-token', calendarId: 'owner@example.com' }, eventId)
      assertEquals(calls.at(-1), {
        url: `https://www.googleapis.com/calendar/v3/calendars/owner%40example.com/events/${eventId}`,
        method: 'DELETE', authorization: 'Bearer test-token',
      })
    }
    assertEquals(calls.length, eventIds.length)
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('公開の空き枠照会: body の LINE ID では自分の仮押さえ扱いにしない', async () => {
  const fake = createFakeSupabase((q) => {
    if (q.table === 'stores') return { data: { slot_interval_minutes: 60 }, error: null }
    if (q.table === 'booking_special_dates') return { data: { is_closed: true }, error: null }
    return { data: [], error: null }
  })
  const res = await handleGetAvailableSlots(fake.client, {
    store_id: STORE, date: date(), line_user_id: 'U-victim',
  }, CORS)
  assertEquals(res.status, 200)
  assertEquals(fake.queries.some((q) => q.filters.some((f) => f.column === 'line_user_id')), false)
  assertEquals(fake.find('temporary_holds', 'delete').length, 0)
})
