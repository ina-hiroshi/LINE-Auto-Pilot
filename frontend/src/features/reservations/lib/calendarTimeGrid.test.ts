import { describe, expect, it } from 'vitest'
import { buildCalendarGridItems, computeOverlapPositions, type CalendarGridItem } from './calendarTimeGrid'
import type { GoogleEvent, Reservation } from '../types'

const HOURS = { start: 9, end: 20 }

/** ローカル時刻で組み立てる（実装が getHours() を使うため） */
const local = (h: number, m = 0) => {
  const d = new Date(2026, 8, 1, h, m, 0)
  return d.toISOString()
}

const reservation = (id: string, from: [number, number], to: [number, number]): Reservation =>
  ({
    id,
    store_id: 'store-1',
    line_user_id: 'U1',
    start_time: local(from[0], from[1]),
    end_time: local(to[0], to[1]),
    status: 'confirmed',
  }) as unknown as Reservation

const googleEvent = (id: string, from: [number, number] | null, to?: [number, number]): GoogleEvent => ({
  id,
  summary: `予定${id}`,
  start: from ? { dateTime: local(from[0], from[1]) } : { date: '2026-09-01' },
  end: to ? { dateTime: local(to[0], to[1]) } : {},
  htmlLink: 'https://example.test',
})

const ids = (items: CalendarGridItem[]) => items.map((i) => i.id)

describe('カレンダーの時間グリッド生成', () => {
  it('予約を開始時刻の分に変換する', () => {
    const [item] = buildCalendarGridItems([reservation('r1', [10, 30], [11, 0])], [], HOURS, false)
    expect(item).toMatchObject({
      id: 'r1',
      type: 'reservation',
      startMinutes: 10 * 60 + 30,
      endMinutes: 11 * 60,
    })
  })

  it('開始が早い順に並べ替える', () => {
    const items = buildCalendarGridItems(
      [reservation('遅い', [15, 0], [16, 0]), reservation('早い', [10, 0], [11, 0])],
      [],
      HOURS,
      false,
    )
    expect(ids(items)).toEqual(['早い', '遅い'])
  })

  it('表示開始時刻より前に始まる予約はグリッドに出さない', () => {
    // 9:00 表示開始に対し 8:30 開始の予約は描画対象外になる（既知の挙動）
    const items = buildCalendarGridItems(
      [reservation('早朝', [8, 30], [9, 30]), reservation('通常', [10, 0], [11, 0])],
      [],
      HOURS,
      false,
    )
    expect(ids(items)).toEqual(['通常'])
  })

  it('表示開始時刻ちょうどの予約は出す', () => {
    const items = buildCalendarGridItems([reservation('開店', [9, 0], [10, 0])], [], HOURS, false)
    expect(ids(items)).toEqual(['開店'])
  })

  describe('Google カレンダー連携', () => {
    it('連携offなら Google の予定を混ぜない', () => {
      const items = buildCalendarGridItems(
        [reservation('r1', [10, 0], [11, 0])],
        [googleEvent('g1', [12, 0], [13, 0])],
        HOURS,
        false,
      )
      expect(ids(items)).toEqual(['r1'])
    })

    it('連携onなら予約と混ぜて時刻順に並べる', () => {
      const items = buildCalendarGridItems(
        [reservation('r1', [14, 0], [15, 0])],
        [googleEvent('g1', [12, 0], [13, 0])],
        HOURS,
        true,
      )
      expect(ids(items)).toEqual(['g1', 'r1'])
      expect(items[0].type).toBe('google')
    })

    it('終日予定（dateTime 無し）は時間軸に置かない', () => {
      const items = buildCalendarGridItems([], [googleEvent('終日', null)], HOURS, true)
      expect(items).toHaveLength(0)
    })

    it('終了時刻が無い予定は1時間として扱う', () => {
      const [item] = buildCalendarGridItems([], [googleEvent('g1', [12, 0])], HOURS, true)
      expect(item.endMinutes - item.startMinutes).toBe(60)
    })
  })
})

describe('重なりの列割り当て', () => {
  const positionsOf = (items: CalendarGridItem[]) => computeOverlapPositions(items)

  const build = (rows: Array<[string, [number, number], [number, number]]>) =>
    buildCalendarGridItems(
      rows.map(([id, from, to]) => reservation(id, from, to)),
      [],
      HOURS,
      false,
    )

  it('重ならない予約はどれも1列で全幅', () => {
    const pos = positionsOf(build([
      ['a', [10, 0], [11, 0]],
      ['b', [11, 0], [12, 0]],
    ]))
    expect(pos.get('a')).toEqual({ column: 0, totalColumns: 1 })
    expect(pos.get('b')).toEqual({ column: 0, totalColumns: 1 })
  })

  it('境界が接するだけ（前の終了＝次の開始）は重なりにしない', () => {
    const pos = positionsOf(build([
      ['a', [10, 0], [11, 0]],
      ['b', [11, 0], [12, 0]],
    ]))
    expect(pos.get('b')!.totalColumns).toBe(1)
  })

  it('重なる2件は別の列に分けて2分割にする', () => {
    const pos = positionsOf(build([
      ['a', [10, 0], [11, 0]],
      ['b', [10, 30], [11, 30]],
    ]))
    expect(pos.get('a')).toEqual({ column: 0, totalColumns: 2 })
    expect(pos.get('b')).toEqual({ column: 1, totalColumns: 2 })
  })

  it('3件重なれば3分割にする', () => {
    const pos = positionsOf(build([
      ['a', [10, 0], [12, 0]],
      ['b', [10, 30], [11, 30]],
      ['c', [11, 0], [11, 45]],
    ]))
    expect(new Set([...pos.values()].map((p) => p.column))).toEqual(new Set([0, 1, 2]))
    expect([...pos.values()].every((p) => p.totalColumns === 3)).toBe(true)
  })

  it('同じグループ内で空いた列を再利用する', () => {
    // a(10-12) と b(10:30-11) が重なり、c(11-11:30) は b とは重ならないので b の列に入る
    const pos = positionsOf(build([
      ['a', [10, 0], [12, 0]],
      ['b', [10, 30], [11, 0]],
      ['c', [11, 0], [11, 30]],
    ]))
    expect(pos.get('a')!.column).toBe(0)
    expect(pos.get('b')!.column).toBe(1)
    expect(pos.get('c')!.column).toBe(1)
    expect(pos.get('c')!.totalColumns).toBe(2)
  })

  it('別グループの分割数は互いに影響しない', () => {
    const pos = positionsOf(build([
      ['a', [10, 0], [11, 0]],
      ['b', [10, 30], [11, 0]],
      ['単独', [15, 0], [16, 0]],
    ]))
    expect(pos.get('a')!.totalColumns).toBe(2)
    expect(pos.get('単独')).toEqual({ column: 0, totalColumns: 1 })
  })

  it('予約とGoogle予定が重なっても同じグループとして分割する', () => {
    const items = buildCalendarGridItems(
      [reservation('r1', [10, 0], [11, 0])],
      [googleEvent('g1', [10, 30], [11, 30])],
      HOURS,
      true,
    )
    const pos = computeOverlapPositions(items)
    expect(pos.get('r1')!.totalColumns).toBe(2)
    expect(pos.get('g1')!.totalColumns).toBe(2)
  })

  it('空配列でも例外にしない', () => {
    expect(computeOverlapPositions([]).size).toBe(0)
  })
})
