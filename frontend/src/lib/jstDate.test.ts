import { describe, it, expect } from 'vitest'
import { getJstDayOfWeek, getJstDateStringWithOffset } from './jstDate'

describe('jstDate', () => {
  it('getJstDayOfWeek returns correct weekday for calendar date (UTC-safe)', () => {
    // 2026-05-21 is Thursday — must not depend on local/Edge TZ
    expect(getJstDayOfWeek('2026-05-21')).toBe(4)
    expect(getJstDayOfWeek('2026-05-24')).toBe(0) // Sunday
  })

  it('getJstDateStringWithOffset returns consecutive JST dates', () => {
    const today = getJstDateStringWithOffset(0)
    const tomorrow = getJstDateStringWithOffset(1)
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(today).not.toBe(tomorrow)
  })
})
