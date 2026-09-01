import { assertEquals, assertRejects } from 'jsr:@std/assert@^1.0.0'
import { createFakeSupabase, type FakeHandler, type FakeQuery } from './testSupabase.ts'
import { handleGetBookingResources } from './resources.ts'
import { ClientVisibleError } from '../../_shared/error-utils.ts'

const CORS = { 'Access-Control-Allow-Origin': '*' }
const STORE = '11111111-1111-4111-8111-111111111111'

const STAFF_ACTIVE = { id: 's1', name: '田中', role: null, image_url: null, is_active: true }
const STAFF_INACTIVE = { id: 's2', name: '休職中', role: null, image_url: null, is_active: false }
const MENU_ACTIVE = {
  id: 'm1', name: 'カット', description: null, price: 4000,
  duration_minutes: 60, capacity_per_slot: 1, is_active: true,
}
const MENU_INACTIVE = {
  id: 'm2', name: '廃止メニュー', description: null, price: 3000,
  duration_minutes: 30, capacity_per_slot: 1, is_active: false,
}
const SPECIAL_DATE = { date: '2026-12-31', is_closed: true, override_hours: null }

type World = {
  staff?: unknown[]
  menus?: unknown[]
  specialDates?: unknown[]
  errorTable?: string
}

function setup(world: World = {}) {
  const { staff = [STAFF_ACTIVE], menus = [MENU_ACTIVE], specialDates = [SPECIAL_DATE], errorTable } = world

  const handler: FakeHandler = (q: FakeQuery) => {
    if (errorTable === q.table) return { data: null, error: { message: 'db error' } }
    if (q.table === 'staff_members') return { data: staff, error: null }
    if (q.table === 'booking_menus') return { data: menus, error: null }
    if (q.table === 'booking_special_dates') return { data: specialDates, error: null }
    return { data: null, error: null }
  }
  return createFakeSupabase(handler)
}

const call = (fake: ReturnType<typeof setup>, storeId: string | undefined) =>
  handleGetBookingResources(fake.client, { store_id: storeId }, CORS)

const expectClientError = (fn: () => Promise<unknown>, message: string) =>
  assertRejects(fn, ClientVisibleError, message)

Deno.test('store_id が無ければ断る', async () => {
  const fake = setup()
  await expectClientError(() => call(fake, undefined), 'store_id is required')
  assertEquals(fake.queries.length, 0)
})

Deno.test('store_id が UUID でなければ断る', async () => {
  const fake = setup()
  await expectClientError(() => call(fake, 'not-a-uuid'), 'Invalid store_id format')
})

Deno.test('スタッフ・メニュー・特定日をまとめて返す', async () => {
  const fake = setup()
  const res = await call(fake, STORE)
  const body = await res.json()

  assertEquals(body.staffList, [STAFF_ACTIVE])
  assertEquals(body.menuList, [MENU_ACTIVE])
  assertEquals(body.specialDates, [SPECIAL_DATE])
})

Deno.test('稼働中(is_active)のスタッフだけを返す', async () => {
  const fake = setup({ staff: [STAFF_ACTIVE, STAFF_INACTIVE] })
  await call(fake, STORE)

  const q = fake.find('staff_members')[0]
  assertEquals(fake.filterValue(q, 'is_active'), true)
})

Deno.test('公開中(is_active)のメニューだけを返す', async () => {
  const fake = setup({ menus: [MENU_ACTIVE, MENU_INACTIVE] })
  await call(fake, STORE)

  const q = fake.find('booking_menus')[0]
  assertEquals(fake.filterValue(q, 'is_active'), true)
})

Deno.test('3テーブルすべて指定した店舗だけに絞り込む', async () => {
  const fake = setup()
  await call(fake, STORE)

  for (const table of ['staff_members', 'booking_menus', 'booking_special_dates']) {
    const q = fake.find(table)[0]
    assertEquals(fake.filterValue(q, 'store_id'), STORE, `${table} が store_id で絞られていない`)
  }
})

Deno.test('該当データが無ければ空配列を返す（null にしない）', async () => {
  const fake = setup({ staff: [], menus: [], specialDates: [] })
  const res = await call(fake, STORE)
  const body = await res.json()

  assertEquals(body, { staffList: [], menuList: [], specialDates: [] })
})

Deno.test('スタッフ取得が失敗したらエラーにする', async () => {
  const fake = setup({ errorTable: 'staff_members' })
  await expectClientError(() => call(fake, STORE), 'db error')
})

Deno.test('メニュー取得が失敗したらエラーにする', async () => {
  const fake = setup({ errorTable: 'booking_menus' })
  await expectClientError(() => call(fake, STORE), 'db error')
})

Deno.test('特定日取得が失敗したらエラーにする', async () => {
  const fake = setup({ errorTable: 'booking_special_dates' })
  await expectClientError(() => call(fake, STORE), 'db error')
})
