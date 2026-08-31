import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import {
  analyzeGoogleEventsForStaff,
  extractStaffFromGoogleEvent,
  formatTimeInJst,
  getJstDateString,
  getJstDayOfWeek,
  isExcludedGoogleEventForModify,
  isOverlapping,
  isPastDate,
  isValidDate,
  isValidTime,
  isValidUUID,
  isWithinMaxBookingDays,
  parseBusinessHours,
  reservationBlocksOverlap,
  resolveStaffEffectiveHours,
  toJstDate,
  type ModifyExcludeContext,
} from './utils.ts'

// ---- 日付・時刻（JST固定であることが予約枠計算の前提） ----

Deno.test('getJstDayOfWeek: 曜日を実行環境のタイムゾーンに依存せず返す', () => {
  // 2026-08-31 は月曜
  assertEquals(getJstDayOfWeek('2026-08-31'), 1)
  assertEquals(getJstDayOfWeek('2026-08-30'), 0) // 日
  assertEquals(getJstDayOfWeek('2026-09-05'), 6) // 土
})

Deno.test('formatTimeInJst: UTCのDateをJSTのHH:MMで返す', () => {
  // 2026-08-31T01:00:00Z = JST 10:00
  assertEquals(formatTimeInJst(new Date('2026-08-31T01:00:00Z')), '10:00')
  // JST 00:30（日付をまたぐ）
  assertEquals(formatTimeInJst(new Date('2026-08-30T15:30:00Z')), '00:30')
})

Deno.test('getJstDateString: JSTの暦日を返す', () => {
  // UTC では 8/30 だが JST では 8/31
  assertEquals(getJstDateString(new Date('2026-08-30T15:30:00Z')), '2026-08-31')
})

Deno.test('toJstDate: HH:MM と HH:MM:SS の双方を受け付ける', () => {
  assertEquals(toJstDate('2026-08-31', '10:00').toISOString(), '2026-08-31T01:00:00.000Z')
  assertEquals(toJstDate('2026-08-31', '10:00:00').toISOString(), '2026-08-31T01:00:00.000Z')
})

// ---- 重複判定（ダブルブッキング防止の中核） ----

Deno.test('isOverlapping: 一部でも重なれば true', () => {
  const d = (h: number) => new Date(`2026-08-31T${String(h).padStart(2, '0')}:00:00+09:00`)
  assertEquals(isOverlapping(d(10), d(12), d(11), d(13)), true)
  assertEquals(isOverlapping(d(11), d(13), d(10), d(12)), true)
  // 完全に内包
  assertEquals(isOverlapping(d(10), d(14), d(11), d(12)), true)
})

Deno.test('isOverlapping: 隣接（終了＝開始）は重複としない', () => {
  const d = (h: number) => new Date(`2026-08-31T${String(h).padStart(2, '0')}:00:00+09:00`)
  // 10:00-11:00 と 11:00-12:00 は連続して予約できる
  assertEquals(isOverlapping(d(10), d(11), d(11), d(12)), false)
  assertEquals(isOverlapping(d(11), d(12), d(10), d(11)), false)
})

// ---- 営業時間 ----

Deno.test('parseBusinessHours: 対象日の曜日の枠だけを返す', () => {
  const hours = {
    mon: [{ start: '10:00', end: '19:00' }],
    sun: [{ start: '11:00', end: '17:00' }],
  }
  assertEquals(parseBusinessHours(hours, '2026-08-31'), [{ start: '10:00', end: '19:00' }])
  assertEquals(parseBusinessHours(hours, '2026-08-30'), [{ start: '11:00', end: '17:00' }])
})

Deno.test('parseBusinessHours: 定休日（該当曜日なし）は空配列', () => {
  assertEquals(parseBusinessHours({ mon: [{ start: '10:00', end: '19:00' }] }, '2026-09-01'), [])
})

Deno.test('parseBusinessHours: 中抜け（複数枠）を保つ', () => {
  const hours = { mon: [{ start: '10:00', end: '13:00' }, { start: '15:00', end: '19:00' }] }
  assertEquals(parseBusinessHours(hours, '2026-08-31'), [
    { start: '10:00', end: '13:00' },
    { start: '15:00', end: '19:00' },
  ])
})

Deno.test('parseBusinessHours: 不正な入力でも落ちずに空配列', () => {
  assertEquals(parseBusinessHours(null, '2026-08-31'), [])
  assertEquals(parseBusinessHours(undefined, '2026-08-31'), [])
  assertEquals(parseBusinessHours('こわれたJSON', '2026-08-31'), [])
  assertEquals(parseBusinessHours({ mon: 'not-an-array' }, '2026-08-31'), [])
})

Deno.test('parseBusinessHours: start/end が欠けた枠は捨てる', () => {
  const hours = { mon: [{ start: '10:00' }, { start: '15:00', end: '19:00' }] }
  assertEquals(parseBusinessHours(hours, '2026-08-31'), [{ start: '15:00', end: '19:00' }])
})

// ---- 入力バリデーション ----

Deno.test('isValidUUID', () => {
  assertEquals(isValidUUID('123e4567-e89b-12d3-a456-426614174000'), true)
  assertEquals(isValidUUID('123E4567-E89B-12D3-A456-426614174000'), true)
  assertEquals(isValidUUID('not-a-uuid'), false)
  assertEquals(isValidUUID(''), false)
  assertEquals(isValidUUID(null), false)
  assertEquals(isValidUUID(undefined), false)
})

Deno.test('isValidDate: 存在しない日付を弾く', () => {
  assertEquals(isValidDate('2026-08-31'), true)
  assertEquals(isValidDate('2024-02-29'), true) // 閏年
  assertEquals(isValidDate('2026-02-29'), false) // 平年
  assertEquals(isValidDate('2026-02-30'), false)
  assertEquals(isValidDate('2026-13-01'), false)
  assertEquals(isValidDate('2026/08/31'), false)
  assertEquals(isValidDate(null), false)
})

Deno.test('isValidTime: 範囲外・書式違いを弾く', () => {
  assertEquals(isValidTime('00:00'), true)
  assertEquals(isValidTime('23:59'), true)
  assertEquals(isValidTime('24:00'), false)
  assertEquals(isValidTime('10:60'), false)
  assertEquals(isValidTime('9:00'), false) // ゼロ埋め必須
  assertEquals(isValidTime(null), false)
})

Deno.test('isPastDate: 過去日時を検出する', () => {
  assertEquals(isPastDate('2000-01-01', '10:00'), true)
  assertEquals(isPastDate('2999-01-01', '10:00'), false)
})

Deno.test('isWithinMaxBookingDays: 受付期間の内外を判定する', () => {
  const today = getJstDateString(new Date())
  assertEquals(isWithinMaxBookingDays(today, 30), true)

  const far = new Date()
  far.setDate(far.getDate() + 60)
  assertEquals(isWithinMaxBookingDays(getJstDateString(far), 30), false)
  assertEquals(isWithinMaxBookingDays(getJstDateString(far), 90), true)
})

// ---- スタッフの勤務時間 ----

Deno.test('resolveStaffEffectiveHours: 基本シフトを返す', () => {
  const hours = resolveStaffEffectiveHours(
    { start_time: '10:00:00', end_time: '19:00:00', is_active: true },
    null,
  )
  assertEquals(hours, [{ start: '10:00', end: '19:00' }])
})

Deno.test('resolveStaffEffectiveHours: 休みの指定が最優先', () => {
  const hours = resolveStaffEffectiveHours(
    { start_time: '10:00', end_time: '19:00', is_active: true },
    { is_absent: true },
  )
  assertEquals(hours, [])
})

Deno.test('resolveStaffEffectiveHours: 特定日の上書きが基本シフトに勝つ', () => {
  const hours = resolveStaffEffectiveHours(
    { start_time: '10:00', end_time: '19:00', is_active: true },
    { override_start: '13:00:00', override_end: '17:00:00' },
  )
  assertEquals(hours, [{ start: '13:00', end: '17:00' }])
})

Deno.test('resolveStaffEffectiveHours: 上書きは休止中の基本シフトも復活させる', () => {
  const hours = resolveStaffEffectiveHours(
    { start_time: '10:00', end_time: '19:00', is_active: false },
    { override_start: '13:00', override_end: '17:00' },
  )
  assertEquals(hours, [{ start: '13:00', end: '17:00' }])
})

Deno.test('resolveStaffEffectiveHours: 無効なシフトは空', () => {
  assertEquals(resolveStaffEffectiveHours(null, null), [])
  assertEquals(
    resolveStaffEffectiveHours({ start_time: '10:00', end_time: '19:00', is_active: false }, null),
    [],
  )
})

Deno.test('resolveStaffEffectiveHours: slots があれば start/end より優先する', () => {
  const hours = resolveStaffEffectiveHours(
    {
      start_time: '10:00',
      end_time: '19:00',
      is_active: true,
      slots: [{ start: '10:00:00', end: '13:00:00' }, { start: '15:00:00', end: '19:00:00' }],
    },
    null,
  )
  assertEquals(hours, [{ start: '10:00', end: '13:00' }, { start: '15:00', end: '19:00' }])
})

Deno.test('resolveStaffEffectiveHours: slots が空なら start/end にフォールバック', () => {
  const hours = resolveStaffEffectiveHours(
    { start_time: '10:00', end_time: '19:00', is_active: true, slots: [] },
    null,
  )
  assertEquals(hours, [{ start: '10:00', end: '19:00' }])
})

// ---- 予約の重複ブロック ----

const slotStart = new Date('2026-08-31T01:00:00Z') // JST 10:00
const slotEnd = new Date('2026-08-31T02:00:00Z') // JST 11:00

Deno.test('reservationBlocksOverlap: 重なる予約は枠を塞ぐ', () => {
  const blocked = reservationBlocksOverlap(
    {
      id: 'r1',
      status: 'confirmed',
      start_time: '2026-08-31T01:30:00Z',
      end_time: '2026-08-31T02:30:00Z',
    },
    slotStart,
    slotEnd,
  )
  assertEquals(blocked, true)
})

Deno.test('reservationBlocksOverlap: 変更対象の予約自身は塞がない', () => {
  const modifyExclude: ModifyExcludeContext = {
    reservationId: 'r1',
    startTimeIso: '2026-08-31T01:00:00Z',
    endTimeIso: '2026-08-31T02:00:00Z',
  }
  const blocked = reservationBlocksOverlap(
    {
      id: 'r1',
      status: 'confirmed',
      start_time: '2026-08-31T01:00:00Z',
      end_time: '2026-08-31T02:00:00Z',
    },
    slotStart,
    slotEnd,
    modifyExclude,
  )
  assertEquals(blocked, false)
})

Deno.test('reservationBlocksOverlap: 自分の仮押さえは自分をブロックしない', () => {
  const row = {
    id: 'r2',
    status: 'temporary',
    line_user_id: 'U1',
    start_time: '2026-08-31T01:00:00Z',
    end_time: '2026-08-31T02:00:00Z',
  }
  assertEquals(reservationBlocksOverlap(row, slotStart, slotEnd, undefined, 'U1'), false)
  // 他人の仮押さえは塞ぐ
  assertEquals(reservationBlocksOverlap(row, slotStart, slotEnd, undefined, 'U2'), true)
})

// ---- 予約変更時のGoogleカレンダー除外 ----

const modifyCtx: ModifyExcludeContext = {
  reservationId: 'res-123',
  googleEventId: 'evt-abc',
  lineUserId: 'U1',
  staffName: '田中',
  startTimeIso: '2026-08-31T01:00:00Z',
  endTimeIso: '2026-08-31T02:00:00Z',
}

Deno.test('isExcludedGoogleEventForModify: 変更対象でなければ常に除外しない', () => {
  const event = { id: 'evt-abc', summary: '予約: 山田' }
  assertEquals(isExcludedGoogleEventForModify(event, 'U1', undefined), false)
})

Deno.test('isExcludedGoogleEventForModify: 説明に予約IDがあれば除外する', () => {
  const event = { summary: '何か', description: '予約ID: res-123' }
  assertEquals(isExcludedGoogleEventForModify(event, 'U1', modifyCtx), true)
})

Deno.test('isExcludedGoogleEventForModify: イベントIDが一致すれば除外する', () => {
  assertEquals(isExcludedGoogleEventForModify({ id: 'evt-abc' }, 'U1', modifyCtx), true)
  // Google が付ける @ 以降のサフィックスを無視して一致させる
  assertEquals(
    isExcludedGoogleEventForModify({ id: 'evt-abc@google.com' }, 'U1', modifyCtx),
    true,
  )
})

Deno.test('isExcludedGoogleEventForModify: 外部予約（HPB等）は除外しない', () => {
  // 自店LIFF予約の書式でなく、時間帯も変更前とずれている外部予約
  const hotpepper = {
    id: 'hpb-1',
    summary: 'ホットペッパー予約 佐藤様',
    description: 'HPB経由',
    start: { dateTime: '2026-08-31T04:00:00Z' },
    end: { dateTime: '2026-08-31T05:00:00Z' },
  }
  assertEquals(isExcludedGoogleEventForModify(hotpepper, 'U1', modifyCtx), false)
})

Deno.test('isExcludedGoogleEventForModify: 変更前と同時間帯の自店予約は除外する', () => {
  const own = {
    id: 'other',
    summary: '予約: 山田様',
    description: 'LINE: U1',
    start: { dateTime: '2026-08-31T01:00:00Z' },
    end: { dateTime: '2026-08-31T02:00:00Z' },
  }
  assertEquals(isExcludedGoogleEventForModify(own, 'U1', modifyCtx), true)
})

Deno.test('isExcludedGoogleEventForModify: 別日の終日イベントは除外しない', () => {
  const allDay = { summary: '棚卸し', start: { date: '2026-09-15' } }
  assertEquals(isExcludedGoogleEventForModify(allDay, 'U1', modifyCtx), false)
})

// ---- Googleイベントからのスタッフ推定 ----

const staffList = [
  { id: 's1', name: '田中' },
  { id: 's2', name: '佐藤' },
]

Deno.test('extractStaffFromGoogleEvent: 件名からスタッフを特定する', () => {
  assertEquals(extractStaffFromGoogleEvent({ summary: '予約: 田中 担当' }, staffList)?.id, 's1')
})

Deno.test('extractStaffFromGoogleEvent: 説明文からも特定する', () => {
  assertEquals(
    extractStaffFromGoogleEvent({ summary: '予約', description: '担当: 佐藤' }, staffList)?.id,
    's2',
  )
})

Deno.test('extractStaffFromGoogleEvent: 該当が無ければ null', () => {
  assertEquals(extractStaffFromGoogleEvent({ summary: '会議' }, staffList), null)
})

Deno.test('analyzeGoogleEventsForStaff: 枠に重なるイベントだけを数える', () => {
  const events = [
    // 枠に重なる・スタッフ特定可
    {
      summary: '予約: 田中',
      start: { dateTime: '2026-08-31T01:00:00Z' },
      end: { dateTime: '2026-08-31T02:00:00Z' },
    },
    // 枠に重ならない
    {
      summary: '予約: 佐藤',
      start: { dateTime: '2026-08-31T05:00:00Z' },
      end: { dateTime: '2026-08-31T06:00:00Z' },
    },
    // 枠に重なる・スタッフ不明
    {
      summary: '打ち合わせ',
      start: { dateTime: '2026-08-31T01:30:00Z' },
      end: { dateTime: '2026-08-31T02:30:00Z' },
    },
  ]

  const result = analyzeGoogleEventsForStaff(events, staffList, slotStart, slotEnd)
  assertEquals(result.identifiedStaffIds, ['s1'])
  assertEquals(result.unknownEventCount, 1)
})

Deno.test('analyzeGoogleEventsForStaff: 終日イベント（dateTimeなし）は対象外', () => {
  const events = [{ summary: '予約: 田中', start: {}, end: {} }]
  const result = analyzeGoogleEventsForStaff(events, staffList, slotStart, slotEnd)
  assertEquals(result.identifiedStaffIds, [])
  assertEquals(result.unknownEventCount, 0)
})
