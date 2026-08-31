import { describe, it, expect } from 'vitest'
import {
  canPayReservation,
  formatYen,
  getJstDateString,
  getPaymentStatusBadgeClass,
  getReservationStatusLabel,
  isLineCustomer,
} from './reservationStatus'

describe('reservationStatus', () => {
  it('maps paid to 決済完了', () => {
    expect(getReservationStatusLabel('paid')).toBe('決済完了')
    expect(getReservationStatusLabel('confirmed')).toBe('未決済')
  })

  it('canPayReservation allows same day in JST', () => {
    const today = getJstDateString(new Date())
    const noon = `${today}T12:00:00+09:00`
    expect(canPayReservation(noon)).toBe(true)
  })
})

describe('getReservationStatusLabel', () => {
  it('全ステータスに日本語ラベルを返す', () => {
    expect(getReservationStatusLabel('confirmed')).toBe('未決済')
    expect(getReservationStatusLabel('pending')).toBe('未決済')
    expect(getReservationStatusLabel('paid')).toBe('決済完了')
    expect(getReservationStatusLabel('cancelled')).toBe('キャンセル')
    expect(getReservationStatusLabel('temporary')).toBe('仮予約')
  })

  it('未知のステータスはそのまま返す（空欄にしない）', () => {
    expect(getReservationStatusLabel('no_show')).toBe('no_show')
  })
})

describe('getPaymentStatusBadgeClass', () => {
  it('決済完了は緑、キャンセルは赤、それ以外は警告色', () => {
    expect(getPaymentStatusBadgeClass('paid')).toContain('emerald')
    expect(getPaymentStatusBadgeClass('cancelled')).toContain('red')
    expect(getPaymentStatusBadgeClass('confirmed')).toContain('amber')
    expect(getPaymentStatusBadgeClass('temporary')).toContain('amber')
  })
})

describe('formatYen', () => {
  it('3桁区切りの円表記にする', () => {
    expect(formatYen(0)).toBe('¥0')
    expect(formatYen(1000)).toBe('¥1,000')
    expect(formatYen(1234567)).toBe('¥1,234,567')
  })

  it('未設定・NaN は em dash にする（¥0 と区別する）', () => {
    expect(formatYen(null)).toBe('—')
    expect(formatYen(undefined)).toBe('—')
    expect(formatYen(NaN)).toBe('—')
  })
})

describe('isLineCustomer', () => {
  it('LINE連携済みの顧客を判定する', () => {
    expect(isLineCustomer('U1234567890abcdef')).toBe(true)
  })

  it('手動登録（MANUAL_接頭辞）は LINE 顧客ではない', () => {
    expect(isLineCustomer('MANUAL_1735689600000')).toBe(false)
  })

  it('未設定は LINE 顧客ではない', () => {
    expect(isLineCustomer(null)).toBe(false)
    expect(isLineCustomer(undefined)).toBe(false)
    expect(isLineCustomer('')).toBe(false)
  })
})

describe('getJstDateString', () => {
  it('UTC日付をまたいでもJSTの暦日を返す', () => {
    expect(getJstDateString(new Date('2026-08-30T15:30:00Z'))).toBe('2026-08-31')
    expect(getJstDateString(new Date('2026-08-30T14:59:00Z'))).toBe('2026-08-30')
  })
})
