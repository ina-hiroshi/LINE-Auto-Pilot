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
  for (const eventId of ['../calendars/primary', '..', 'abcde?x=1', 'abcde#x', '%2e%2e']) {
    await assertRejects(() => deleteGoogleEvent({ accessToken: 'unused', calendarId: 'primary' }, eventId), Error, 'Invalid Google event ID')
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
