import { describe, it, expect } from 'vitest'
import { getReservationStatusLabel, canPayReservation, getJstDateString } from './reservationStatus'

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
