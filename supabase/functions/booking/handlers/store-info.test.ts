import { assertEquals, assertRejects } from 'jsr:@std/assert@^1.0.0'
import { createFakeSupabase, type FakeHandler, type FakeQuery } from './testSupabase.ts'
import { handleGetStorePublicInfo } from './store-info.ts'
import { ClientVisibleError } from '../../_shared/error-utils.ts'

const CORS = { 'Access-Control-Allow-Origin': '*' }
const STORE_A = '11111111-1111-4111-8111-111111111111'
const STORE_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const storeRow = (id: string, name: string) => ({
  id,
  name,
  liff_template_id: 'simple',
  liff_theme_color: '#000000',
  liff_logo_url: '',
  booking_system_type: 'generic',
  slot_interval_minutes: 60,
  capacity_per_slot: 1,
  max_booking_days: 60,
  business_hours: null,
  booking_enable_party_size: false,
  booking_enable_staff: false,
  booking_enable_menu: false,
  membership_card_title: "MEMBER'S CARD",
  membership_card_color: '#000000',
  membership_card_logo_url: null,
  membership_card_template_id: 'simple',
  membership_card_settings: {},
  membership_rank_settings: null,
})

type World = { stores?: unknown[]; error?: unknown }

function setup(world: World = {}) {
  const { stores = [storeRow(STORE_A, 'IToguchi')], error = null } = world
  const handler: FakeHandler = (q: FakeQuery) => {
    if (q.table !== 'stores') return { data: null, error: null }
    if (error) return { data: null, error }
    if (q.cardinality === 'maybeSingle') {
      const id = q.filters.find((f) => f.column === 'id')?.value
      return { data: stores.find((s) => (s as { id: string }).id === id) ?? null, error: null }
    }
    return { data: stores, error: null }
  }
  return createFakeSupabase(handler)
}

const call = (fake: ReturnType<typeof setup>, storeId?: string) =>
  handleGetStorePublicInfo(fake.client, { store_id: storeId }, CORS)

Deno.test('store_id を指定すればその店舗だけを返す', async () => {
  const fake = setup({ stores: [storeRow(STORE_A, '店A'), storeRow(STORE_B, '店B')] })
  const res = await call(fake, STORE_A)
  const body = await res.json()

  assertEquals(body.store.id, STORE_A)
  assertEquals(body.store.name, '店A')
})

Deno.test('store_id が UUID でなければ断る', async () => {
  const fake = setup()
  await assertRejects(() => call(fake, 'not-a-uuid'), ClientVisibleError, 'Invalid store_id format')
})

Deno.test('store_id 指定時は id で絞り込む', async () => {
  const fake = setup()
  await call(fake, STORE_A)

  const q = fake.find('stores')[0]
  assertEquals(fake.filterValue(q, 'id'), STORE_A)
  assertEquals(q.cardinality, 'maybeSingle')
})

Deno.test('存在しない店舗IDなら store は null', async () => {
  const fake = setup({ stores: [] })
  const res = await call(fake, STORE_A)
  assertEquals(await res.json(), { store: null })
})

Deno.test('store_id 省略時、店舗が1件だけならそれを返す', async () => {
  const fake = setup({ stores: [storeRow(STORE_A, '唯一の店')] })
  const res = await call(fake)
  const body = await res.json()
  assertEquals(body.store.id, STORE_A)
})

Deno.test('store_id 省略時、店舗が複数あれば null を返す（他店を漏らさない）', async () => {
  const fake = setup({ stores: [storeRow(STORE_A, '店A'), storeRow(STORE_B, '店B')] })
  const res = await call(fake)
  assertEquals(await res.json(), { store: null })
})

Deno.test('store_id 省略時、店舗が0件でも null を返す', async () => {
  const fake = setup({ stores: [] })
  const res = await call(fake)
  assertEquals(await res.json(), { store: null })
})

Deno.test('store_id 省略時の判定は最大2件だけ取得する（全件は引かない）', async () => {
  const fake = setup({ stores: [storeRow(STORE_A, '店A'), storeRow(STORE_B, '店B')] })
  await call(fake)

  const q = fake.find('stores')[0]
  assertEquals(q.cardinality, 'many')
})

Deno.test('DBエラーはそのままエラーにする', async () => {
  const fake = setup({ error: { message: 'db down' } })
  await assertRejects(() => call(fake, STORE_A), ClientVisibleError, 'db down')
})

Deno.test('会員証設定と予約設定の両方の列を返す', async () => {
  const fake = setup({ stores: [storeRow(STORE_A, '店A')] })
  const res = await call(fake, STORE_A)
  const body = await res.json()

  assertEquals(body.store.booking_enable_staff, false)
  assertEquals(body.store.membership_card_title, "MEMBER'S CARD")
})
