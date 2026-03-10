import { describe, it, expect } from 'vitest'
import { isPaidPlan } from './planUtils'

describe('isPaidPlan', () => {
  it('returns true for pro', () => {
    expect(isPaidPlan('pro')).toBe(true)
  })

  it('returns true for executive', () => {
    expect(isPaidPlan('executive')).toBe(true)
  })

  it('returns false for free', () => {
    expect(isPaidPlan('free')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isPaidPlan(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isPaidPlan(undefined)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isPaidPlan('')).toBe(false)
  })
})
