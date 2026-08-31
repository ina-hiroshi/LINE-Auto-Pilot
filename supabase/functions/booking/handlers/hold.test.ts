import { assertEquals, assertRejects } from 'jsr:@std/assert@^1.0.0'
import { createFakeSupabase, type FakeHandler, type FakeQuery } from './testSupabase.ts'
import { handleHoldSlot, handleReleaseHold } from './hold.ts'
import { ClientVisibleError } from '../../_shared/error-utils.ts'

const CORS = { 'Access-Control-Allow-Origin': '*' }
const STORE = '11111111-1111-4111-8111-111111111111'
const STAFF = '22222222-2222-4222-8222-222222222222'
const MENU = '33333333-3333-4333-8333-333333333333'
const USER = 'U-line-1'

/** 未来日（受付期間内） */
const futureDate = () => {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

type World = {
  store?: Record<string, unknown>
  /** 予約テーブルが返す重複行 */
  reservations?: unknown[]
  /** temporary_holds が返す競合行 */
  holds?: unknown[]
  /** 稼働スタッフ（staff_members） */
  staffMembers?: unknown[]
  menu?: Record<string, unknown> | null
}

function setup(world: World = {}) {
  const {
    store = {
      slot_interval_minutes: 60,
      capacity_per_slot: 2,
      business_hours: null,
      max_booking_days: 60,
      booking_enable_staff: true,
    },
    reservations = [],
    holds = [],
    staffMembers = [{ id: STAFF, name: '田中' }],
    menu = null,
  } = world

  const handler: FakeHandler = (q: FakeQuery) => {
    switch (q.table) {
      case 'stores':
        // getGoogleCalendarClient も stores を引くが owner_id しか見ない
        return { data: { ...store, owner_id: 'owner-1' }, error: null }
      case 'google_calendar_settings':
        // 連携なし → getGoogleCalendarClient は null を返し、外部通信しない
        return { data: null, error: null }
      case 'booking_menus':
        return { data: menu, error: null }
      case 'reservations':
        return { data: reservations, error: null }
      case 'temporary_holds':
        if (q.method === 'insert') {
          return { data: { id: 'hold-1', expires_at: '2026-09-01T00:10:00.000Z' }, error: null }
        }
        return { data: holds, error: null }
      case 'staff_members':
        if (q.cardinality === 'maybeSingle') return { data: staffMembers[0] ?? null, error: null }
        return { data: staffMembers, error: null }
      case 'staff_work_patterns':
      case 'staff_special_schedules':
        return { data: [], error: null }
      default:
        return { data: null, error: null }
    }
  }

  return createFakeSupabase(handler)
}

const hold = (fake: ReturnType<typeof setup>, params: Record<string, unknown>) =>
  handleHoldSlot(fake.client, {
    store_id: STORE,
    line_user_id: USER,
    date: futureDate(),
    time: '11:00',
    ...params,
  }, CORS)

const expectClientError = (fn: () => Promise<unknown>, message: string) =>
  assertRejects(fn, ClientVisibleError, message)

// ---- 入力検証 ----

Deno.test('必須項目が欠けていれば断る', async () => {
  const fake = setup()
  await expectClientError(
    () => handleHoldSlot(fake.client, { store_id: STORE, date: futureDate() }, CORS),
    'store_id, date, and time are required',
  )
  // 検証で弾いた時点で DB を触らない
  assertEquals(fake.queries.length, 0)
})

Deno.test('store_id が UUID でなければ断る', async () => {
  const fake = setup()
  await expectClientError(
    () => hold(fake, { store_id: 'not-a-uuid' }),
    'Invalid store_id format',
  )
})

Deno.test('日付・時刻の書式違いを断る', async () => {
  const fake = setup()
  await expectClientError(() => hold(fake, { date: '2026-13-01' }), 'Invalid date format (expected YYYY-MM-DD)')
  await expectClientError(() => hold(fake, { time: '25:00' }), 'Invalid time format (expected HH:MM)')
})

Deno.test('staff_id / menu_id / reservation_id の UUID 書式も検証する', async () => {
  const fake = setup()
  await expectClientError(() => hold(fake, { staff_id: 'x' }), 'Invalid staff_id format')
  await expectClientError(() => hold(fake, { menu_id: 'x' }), 'Invalid menu_id format')
  await expectClientError(() => hold(fake, { reservation_id: 'x' }), 'Invalid reservation_id format')
})

Deno.test('過去日時は仮押さえできない', async () => {
  const fake = setup()
  await expectClientError(
    () => hold(fake, { date: '2020-01-01', time: '10:00' }),
    '過去の日付は予約できません',
  )
})

Deno.test('受付期間を超える先の日付は断る', async () => {
  const fake = setup({
    store: { slot_interval_minutes: 60, capacity_per_slot: 2, max_booking_days: 7, booking_enable_staff: true },
  })
  const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  await expectClientError(() => hold(fake, { date: far }), '予約可能日は7日後までです')
})

// ---- 所要時間 ----

Deno.test('メニューの所要時間を仮押さえの長さに使う', async () => {
  const fake = setup({ menu: { duration_minutes: 90, capacity_per_slot: 1 } })
  await hold(fake, { menu_id: MENU, staff_id: STAFF })

  const insert = fake.find('temporary_holds', 'insert')[0].payload as Record<string, string>
  const minutes = (new Date(insert.end_time).getTime() - new Date(insert.start_time).getTime()) / 60000
  assertEquals(minutes, 90)
})

Deno.test('メニュー未指定なら店舗の枠間隔を使う', async () => {
  const fake = setup({
    store: { slot_interval_minutes: 45, capacity_per_slot: 2, max_booking_days: 60, booking_enable_staff: true },
  })
  await hold(fake, { staff_id: STAFF })

  const insert = fake.find('temporary_holds', 'insert')[0].payload as Record<string, string>
  const minutes = (new Date(insert.end_time).getTime() - new Date(insert.start_time).getTime()) / 60000
  assertEquals(minutes, 45)
})

Deno.test('メニューの所要時間が 0 でも枠間隔にフォールバックする', async () => {
  const fake = setup({ menu: { duration_minutes: 0, capacity_per_slot: 1 } })
  await hold(fake, { menu_id: MENU, staff_id: STAFF })

  const insert = fake.find('temporary_holds', 'insert')[0].payload as Record<string, string>
  const minutes = (new Date(insert.end_time).getTime() - new Date(insert.start_time).getTime()) / 60000
  assertEquals(minutes, 60)
})

// ---- スタッフ指名時の空き判定 ----

Deno.test('指名スタッフに重なる確定予約があれば埋まっていると返す', async () => {
  const fake = setup({ reservations: [{ id: 'r1' }] })
  await expectClientError(
    () => hold(fake, { staff_id: STAFF }),
    'この時間帯の予約枠が埋まっています',
  )
})

Deno.test('指名スタッフに他人の仮押さえがあれば埋まっていると返す', async () => {
  const fake = setup({ holds: [{ id: 'h1', line_user_id: 'U-other' }] })
  await expectClientError(
    () => hold(fake, { staff_id: STAFF }),
    'この時間帯の予約枠が埋まっています',
  )
})

Deno.test('自分の仮押さえは自分を塞がない（選び直しても取れる）', async () => {
  const fake = setup({ holds: [{ id: 'h1', line_user_id: USER }] })
  const res = await hold(fake, { staff_id: STAFF })
  assertEquals(res.status, 200)
})

Deno.test('指名時はキャンセル済み・仮予約を重複判定から除く条件で問い合わせる', async () => {
  const fake = setup()
  await hold(fake, { staff_id: STAFF })

  const q = fake.find('reservations')[0]
  const neqStatus = q.filters.filter((f) => f.op === 'neq' && f.column === 'status').map((f) => f.value)
  assertEquals(neqStatus.sort(), ['cancelled', 'temporary'])
  assertEquals(fake.filterValue(q, 'store_id'), STORE)
  assertEquals(fake.filterValue(q, 'staff_id'), STAFF)
})

Deno.test('期限切れの仮押さえは競合として数えない条件で問い合わせる', async () => {
  const fake = setup()
  await hold(fake, { staff_id: STAFF })

  const q = fake.find('temporary_holds').find((x) => x.filters.some((f) => f.column === 'expires_at'))!
  const f = q.filters.find((x) => x.column === 'expires_at')!
  assertEquals(f.op, 'gt')
})

// ---- スタッフ指名なし（店舗容量） ----

Deno.test('スタッフ未登録なら店舗の同時受入数で判定する', async () => {
  const fake = setup({
    staffMembers: [],
    store: { slot_interval_minutes: 60, capacity_per_slot: 2, max_booking_days: 60, booking_enable_staff: true },
    reservations: [{ id: 'r1' }],
  })
  // 上限2に対し既存1件 → まだ取れる
  const res = await hold(fake, {})
  assertEquals(res.status, 200)
})

Deno.test('店舗の同時受入数に達していれば断る', async () => {
  const fake = setup({
    staffMembers: [],
    store: { slot_interval_minutes: 60, capacity_per_slot: 2, max_booking_days: 60, booking_enable_staff: true },
    reservations: [{ id: 'r1' }, { id: 'r2' }],
  })
  await expectClientError(() => hold(fake, {}), 'この時間帯の予約枠が埋まっています')
})

Deno.test('スタッフ機能オフなら登録があっても店舗容量で判定する', async () => {
  const fake = setup({
    store: { slot_interval_minutes: 60, capacity_per_slot: 1, max_booking_days: 60, booking_enable_staff: false },
    reservations: [{ id: 'r1' }],
  })
  await expectClientError(() => hold(fake, {}), 'この時間帯の予約枠が埋まっています')
})

Deno.test('指名なし店舗容量では担当なしの予約だけを数える', async () => {
  const fake = setup({ staffMembers: [], store: {
    slot_interval_minutes: 60, capacity_per_slot: 2, max_booking_days: 60, booking_enable_staff: true,
  } })
  await hold(fake, {})

  const q = fake.find('reservations')[0]
  assertEquals(q.filters.some((f) => f.op === 'is' && f.column === 'staff_id' && f.value === null), true)
})

Deno.test('スタッフ機能オンで誰も出勤していなければその旨を返す', async () => {
  // staff_members は登録あり、work_patterns / special_schedules は空 → 稼働0
  const fake = setup()
  await expectClientError(() => hold(fake, {}), 'この時間帯に対応可能なスタッフがいません')
})

// ---- 登録内容 ----

Deno.test('仮押さえは店舗・ユーザー・時間帯とともに10分の期限付きで作る', async () => {
  const fake = setup()
  const before = Date.now()
  await hold(fake, { staff_id: STAFF, menu_id: MENU })

  const payload = fake.find('temporary_holds', 'insert')[0].payload as Record<string, string>
  assertEquals(payload.store_id, STORE)
  assertEquals(payload.line_user_id, USER)
  assertEquals(payload.staff_id, STAFF)
  assertEquals(payload.menu_id, MENU)

  const ttl = new Date(payload.expires_at).getTime() - before
  assertEquals(ttl > 9 * 60 * 1000 && ttl <= 10 * 60 * 1000 + 5000, true)
})

Deno.test('新しく取る前に自分の古い仮押さえを消す（多重確保を残さない）', async () => {
  const fake = setup()
  await hold(fake, { staff_id: STAFF })

  const del = fake.find('temporary_holds', 'delete')
  assertEquals(del.length, 1)
  assertEquals(fake.filterValue(del[0], 'line_user_id'), USER)
  assertEquals(fake.filterValue(del[0], 'store_id'), STORE)
})

Deno.test('hold_id と期限を返す', async () => {
  const fake = setup()
  const res = await hold(fake, { staff_id: STAFF })
  assertEquals(await res.json(), { hold_id: 'hold-1', expires_at: '2026-09-01T00:10:00.000Z' })
})

Deno.test('JST として解釈して開始時刻を決める（11:00 JST = 02:00 UTC）', async () => {
  const fake = setup()
  const date = futureDate()
  await hold(fake, { staff_id: STAFF, date, time: '11:00' })

  const payload = fake.find('temporary_holds', 'insert')[0].payload as Record<string, string>
  assertEquals(payload.start_time, `${date}T02:00:00.000Z`)
})

// ---- 解放 ----

Deno.test('解放には store_id と line_user_id の両方が要る', async () => {
  const fake = setup()
  await expectClientError(
    () => handleReleaseHold(fake.client, { store_id: STORE }, CORS),
    'store_id and line_user_id are required',
  )
})

Deno.test('解放は自分の店舗・自分のIDだけを消す', async () => {
  const fake = setup({ holds: [{ id: 'h1', google_event_id: null }] })
  const res = await handleReleaseHold(fake.client, { store_id: STORE, line_user_id: USER }, CORS)

  assertEquals(await res.json(), { success: true })
  const del = fake.find('temporary_holds', 'delete')[0]
  assertEquals(fake.filterValue(del, 'line_user_id'), USER)
  assertEquals(fake.filterValue(del, 'store_id'), STORE)
})

Deno.test('仮押さえが無くても解放は成功として返す', async () => {
  const fake = setup({ holds: [] })
  const res = await handleReleaseHold(fake.client, { store_id: STORE, line_user_id: USER }, CORS)
  assertEquals(res.status, 200)
})
