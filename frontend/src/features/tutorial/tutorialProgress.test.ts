import { describe, expect, it } from 'vitest'
import { isTourSeen, parseProgress } from './tutorialProgress'

describe('parseProgress', () => {
  it('版が正の整数のものだけ残す', () => {
    expect(parseProgress({ dashboard: 1, reservations: 2 })).toEqual({ dashboard: 1, reservations: 2 })
  })

  it('壊れた値は捨てる', () => {
    expect(parseProgress({ a: 0, b: -1, c: 1.5, d: '1', e: null, f: true, ok: 3 })).toEqual({ ok: 3 })
  })

  it('オブジェクト以外は空として扱う', () => {
    expect(parseProgress(null)).toEqual({})
    expect(parseProgress(undefined)).toEqual({})
    expect(parseProgress('dashboard')).toEqual({})
    expect(parseProgress(['dashboard'])).toEqual({})
    expect(parseProgress(1)).toEqual({})
  })
})

describe('isTourSeen', () => {
  it('記録が無ければ未読', () => {
    expect(isTourSeen({}, 'dashboard', 1)).toBe(false)
  })

  it('同じ版以上を見ていれば既読', () => {
    expect(isTourSeen({ dashboard: 1 }, 'dashboard', 1)).toBe(true)
    expect(isTourSeen({ dashboard: 3 }, 'dashboard', 2)).toBe(true)
  })

  it('ツアーの版を上げると再び未読になる', () => {
    expect(isTourSeen({ dashboard: 1 }, 'dashboard', 2)).toBe(false)
  })

  it('別の画面の既読は影響しない', () => {
    expect(isTourSeen({ reservations: 1 }, 'dashboard', 1)).toBe(false)
  })
})
