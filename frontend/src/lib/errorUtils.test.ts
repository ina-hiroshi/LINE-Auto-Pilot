import { describe, it, expect } from 'vitest'
import { toErrorMessage } from './errorUtils'

describe('toErrorMessage', () => {
  it('returns message from Error instance', () => {
    expect(toErrorMessage(new Error('test error'))).toBe('test error')
  })

  it('returns message from object with message property', () => {
    expect(toErrorMessage({ message: 'object error' })).toBe('object error')
  })

  it('converts string to itself', () => {
    expect(toErrorMessage('string error')).toBe('string error')
  })

  it('converts number to string', () => {
    expect(toErrorMessage(42)).toBe('42')
  })

  it('converts null to string', () => {
    expect(toErrorMessage(null)).toBe('null')
  })

  it('converts undefined to string', () => {
    expect(toErrorMessage(undefined)).toBe('undefined')
  })

  it('ignores non-string message property', () => {
    expect(toErrorMessage({ message: 123 })).toBe('[object Object]')
  })
})
