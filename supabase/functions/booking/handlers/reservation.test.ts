import { assertEquals, assertRejects } from 'jsr:@std/assert@^1.0.0'
import { createFakeSupabase, type FakeHandler, type FakeQuery } from './testSupabase.ts'
import { handleCancelReservation, handleCompletePayment } from './reservation.ts'
import { ClientVisibleError } from '../../_shared/error-utils.ts'

const CORS = { 'Access-Control-Allow-Origin': '*' }
const STORE_A = '11111111-1111-4111-8111-111111111111'
const STORE_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const RESERVATION = '44444444-4444-4444-8444-444444444444'
const STAFF = '22222222-2222-4222-8222-222222222222'
const OWNER_USER = 'U-owner'
const GUEST = 'U-guest'

type World = {
  reservation?: Record<string, unknown> | null
  fetchError?: unknown
}

function setup(world: World = {}) {
  const {
    reservation = {
      id: RESERVATION,
      store_id: STORE_A,
      line_user_id: GUEST,
      google_event_id: null,
      status: 'confirmed',
      start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    fetchError = null,
  } = world

  const handler: FakeHandler = (q: FakeQuery) => {
    switch (q.table) {
      case 'reservations':
        if (q.method === 'update') return { data: null, error: null }
        return { data: reservation, error: fetchError }
      case 'stores':
        return { data: { owner_id: 'owner-1' }, error: null }
      case 'google_calendar_settings':
        return { data: null, error: null }
      default:
        return { data: null, error: null }
    }
  }
  return createFakeSupabase(handler)
}

const expectClientError = (fn: () => Promise<unknown>, message: string) =>
  assertRejects(fn, ClientVisibleError, message)

// ---- キャンセル ----

Deno.test('キャンセル: 予約IDが無ければ断る', async () => {
  const fake = setup()
  await expectClientError(
    () => handleCancelReservation(fake.client, { isManualRegistration: true }, CORS),
    'Reservation ID is required',
  )
  assertEquals(fake.queries.length, 0)
})

Deno.test('キャンセル: 予約IDの書式違いを断る', async () => {
  const fake = setup()
  await expectClientError(
    () => handleCancelReservation(fake.client, { reservation_id: 'x', isManualRegistration: true }, CORS),
    'Invalid reservation_id format',
  )
})

Deno.test('キャンセル: 本人の予約なら取り消せる', async () => {
  const fake = setup()
  const res = await handleCancelReservation(
    fake.client,
    { reservation_id: RESERVATION, store_id: STORE_A, line_user_id: GUEST, isManualRegistration: false },
    CORS,
  )

  assertEquals(await res.json(), { success: true })
  const update = fake.find('reservations', 'update')[0]
  assertEquals(update.payload, { status: 'cancelled' })
})

Deno.test('キャンセル: 他人の予約は取り消せない', async () => {
  const fake = setup()
  await expectClientError(
    () =>
      handleCancelReservation(
        fake.client,
        { reservation_id: RESERVATION, store_id: STORE_A, line_user_id: 'U-someone-else', isManualRegistration: false },
        CORS,
      ),
    '自分の予約のみキャンセルできます',
  )
  assertEquals(fake.find('reservations', 'update').length, 0)
})

Deno.test('キャンセル: 自店舗の予約なら店舗管理者が取り消せる', async () => {
  const fake = setup()
  const res = await handleCancelReservation(
    fake.client,
    { reservation_id: RESERVATION, store_id: STORE_A, isManualRegistration: true },
    CORS,
  )
  assertEquals(res.status, 200)
})

Deno.test('キャンセル: 他店舗の予約は店舗管理者でも取り消せない', async () => {
  // 予約は STORE_A のもの。呼び出し元は STORE_B のオーナーとして認証されている。
  const fake = setup()
  await expectClientError(
    () =>
      handleCancelReservation(
        fake.client,
        { reservation_id: RESERVATION, store_id: STORE_B, isManualRegistration: true },
        CORS,
      ),
    'この予約は操作できません',
  )
  assertEquals(fake.find('reservations', 'update').length, 0)
})

Deno.test('キャンセル: 店舗管理者操作で store_id が無ければ断る', async () => {
  const fake = setup()
  await expectClientError(
    () => handleCancelReservation(fake.client, { reservation_id: RESERVATION, isManualRegistration: true }, CORS),
    'この予約は操作できません',
  )
})

Deno.test('キャンセル: 更新も店舗で絞り込む', async () => {
  const fake = setup()
  await handleCancelReservation(
    fake.client,
    { reservation_id: RESERVATION, store_id: STORE_A, isManualRegistration: true },
    CORS,
  )
  const update = fake.find('reservations', 'update')[0]
  assertEquals(fake.filterValue(update, 'store_id'), STORE_A)
  assertEquals(fake.filterValue(update, 'id'), RESERVATION)
})

// ---- 決済 ----

Deno.test('決済: 一般利用者は実行できない', async () => {
  const fake = setup()
  await expectClientError(
    () =>
      handleCompletePayment(
        fake.client,
        { reservation_id: RESERVATION, store_id: STORE_A, paid_amount: 4000, isManualRegistration: false },
        CORS,
      ),
    'この操作は店舗管理者のみ実行できます',
  )
  assertEquals(fake.queries.length, 0)
})

Deno.test('決済: 金額が数値でなければ断る', async () => {
  const fake = setup()
  for (const paid_amount of [undefined, -1, NaN, Infinity]) {
    await expectClientError(
      () =>
        handleCompletePayment(
          fake.client,
          { reservation_id: RESERVATION, store_id: STORE_A, paid_amount, isManualRegistration: true },
          CORS,
        ),
      '決済金額（税込）を正しく入力してください',
    )
  }
})

Deno.test('決済: 予約の取得は店舗で絞り込む（他店舗の予約を掴まない）', async () => {
  const fake = setup()
  await handleCompletePayment(
    fake.client,
    { reservation_id: RESERVATION, store_id: STORE_A, paid_amount: 4000, isManualRegistration: true },
    CORS,
  )
  const fetch = fake.find('reservations', 'select')[0]
  assertEquals(fake.filterValue(fetch, 'store_id'), STORE_A)
})

Deno.test('決済: 未決済(confirmed)以外は断る', async () => {
  const fake = setup({
    reservation: {
      id: RESERVATION, store_id: STORE_A, line_user_id: GUEST, status: 'paid',
      start_time: new Date(Date.now() - 3600_000).toISOString(),
    },
  })
  await expectClientError(
    () =>
      handleCompletePayment(
        fake.client,
        { reservation_id: RESERVATION, store_id: STORE_A, paid_amount: 4000, isManualRegistration: true },
        CORS,
      ),
    '未決済の予約のみ決済できます',
  )
})

Deno.test('決済: 予約日より前には決済できない', async () => {
  const fake = setup({
    reservation: {
      id: RESERVATION, store_id: STORE_A, line_user_id: GUEST, status: 'confirmed',
      start_time: new Date(Date.now() + 5 * 24 * 3600_000).toISOString(),
    },
  })
  await expectClientError(
    () =>
      handleCompletePayment(
        fake.client,
        { reservation_id: RESERVATION, store_id: STORE_A, paid_amount: 4000, isManualRegistration: true },
        CORS,
      ),
    '予約日以降に決済できます',
  )
})

Deno.test('決済: 当日は決済できる', async () => {
  const fake = setup({
    reservation: {
      id: RESERVATION, store_id: STORE_A, line_user_id: GUEST, status: 'confirmed',
      start_time: new Date().toISOString(),
    },
  })
  const res = await handleCompletePayment(
    fake.client,
    { reservation_id: RESERVATION, store_id: STORE_A, paid_amount: 4000, isManualRegistration: true },
    CORS,
  )
  assertEquals(await res.json(), { success: true })
})

Deno.test('決済: 金額を四捨五入して paid_at とともに記録する', async () => {
  const fake = setup()
  await handleCompletePayment(
    fake.client,
    { reservation_id: RESERVATION, store_id: STORE_A, paid_amount: 4000.6, isManualRegistration: true },
    CORS,
  )
  const update = fake.find('reservations', 'update')[0]
  const payload = update.payload as Record<string, unknown>
  assertEquals(payload.status, 'paid')
  assertEquals(payload.paid_amount, 4001)
  assertEquals(typeof payload.paid_at, 'string')
})

Deno.test('決済: 更新は confirmed のときだけに絞る（二重決済を防ぐ）', async () => {
  const fake = setup()
  await handleCompletePayment(
    fake.client,
    { reservation_id: RESERVATION, store_id: STORE_A, paid_amount: 4000, isManualRegistration: true },
    CORS,
  )
  const update = fake.find('reservations', 'update')[0]
  assertEquals(fake.filterValue(update, 'status'), 'confirmed')
  assertEquals(fake.filterValue(update, 'store_id'), STORE_A)
})

Deno.test('決済: 担当とメニューが指定されていれば併せて記録する', async () => {
  const fake = setup()
  await handleCompletePayment(
    fake.client,
    {
      reservation_id: RESERVATION, store_id: STORE_A, paid_amount: 4000,
      staff_id: STAFF, menu_id: null, isManualRegistration: true,
    },
    CORS,
  )
  const payload = fake.find('reservations', 'update')[0].payload as Record<string, unknown>
  assertEquals(payload.staff_id, STAFF)
  assertEquals('menu_id' in payload, false)
})

Deno.test('決済: 予約が見つからなければ更新しない', async () => {
  const fake = setup({ reservation: null, fetchError: { message: 'not found' } })
  await expectClientError(
    () =>
      handleCompletePayment(
        fake.client,
        { reservation_id: RESERVATION, store_id: STORE_A, paid_amount: 4000, isManualRegistration: true },
        CORS,
      ),
    '予約が見つかりません',
  )
  assertEquals(fake.find('reservations', 'update').length, 0)
})
