import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createSupabaseMock, type SupabaseMock } from '../../../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import { PaymentModal } from './PaymentModal'
import type { Reservation } from '../types'

const STORE_ID = 'store-1'

const reservation = (over: Partial<Reservation> = {}): Reservation =>
  ({
    id: 'res-1',
    store_id: STORE_ID,
    line_user_id: 'U1',
    start_time: '2026-08-31T01:00:00Z',
    end_time: '2026-08-31T02:00:00Z',
    status: 'confirmed',
    staff_id: null,
    menu_id: null,
    quoted_amount: null,
    customer: { real_name: '山田 太郎', display_name: 'たろ' },
    ...over,
  }) as Reservation

const staffList = [{ id: 's1', name: '田中' }, { id: 's2', name: '佐藤' }]
const menuList = [{ id: 'm1', name: 'カット', price: 4000 }, { id: 'm2', name: 'カラー', price: 8000 }]

function setup(
  options: {
    reservation?: Reservation
    invoke?: (name: string, body: unknown) => { data: unknown; error: unknown }
  } = {},
) {
  const onSuccess = vi.fn()
  const onClose = vi.fn()

  mock = createSupabaseMock({
    handler: () => ({ data: null, error: null }),
    invoke: options.invoke ?? (() => ({ data: { success: true }, error: null })),
  })

  render(
    <PaymentModal
      isOpen
      onClose={onClose}
      reservation={options.reservation ?? reservation()}
      storeId={STORE_ID}
      staffList={staffList}
      menuList={menuList}
      onSuccess={onSuccess}
    />,
  )

  return { onSuccess, onClose }
}

const amountInput = () => screen.getByRole('spinbutton') as HTMLInputElement
const confirmButton = () => screen.getByRole('button', { name: /決済を確定/ })
const bookingCall = () => mock.invocations.find((i) => i.name === 'booking')

describe('決済モーダル', () => {
  describe('初期表示', () => {
    it('見積金額があればそれを初期値にする', () => {
      setup({ reservation: reservation({ quoted_amount: 6500 }) })
      expect(amountInput().value).toBe('6500')
      expect(screen.getByText(/見込み: ¥6,500/)).toBeInTheDocument()
    })

    it('見積が無ければメニュー価格を初期値にする', () => {
      setup({
        reservation: reservation({ quoted_amount: null, menu: { name: 'カット', price: 4000 } } as Partial<Reservation>),
      })
      expect(amountInput().value).toBe('4000')
    })

    it('どちらも無ければ0にする', () => {
      setup({ reservation: reservation({ quoted_amount: null }) })
      expect(amountInput().value).toBe('0')
    })

    it('顧客名は本名を優先して表示する', () => {
      setup()
      expect(screen.getByText(/山田 太郎 様/)).toBeInTheDocument()
    })

    it('本名が無ければLINE表示名を使う', () => {
      setup({ reservation: reservation({ customer: { real_name: null, display_name: 'たろ' } } as Partial<Reservation>) })
      expect(screen.getByText(/たろ 様/)).toBeInTheDocument()
    })

    it('予約のスタッフ・メニューを初期選択にする', () => {
      setup({ reservation: reservation({ staff_id: 's2', menu_id: 'm2' }) })
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
      expect(selects[0].value).toBe('s2')
      expect(selects[1].value).toBe('m2')
    })
  })

  describe('入力の検証', () => {
    it('空欄では決済を送信しない', async () => {
      setup()
      fireEvent.change(amountInput(), { target: { value: '' } })
      fireEvent.click(confirmButton())

      expect(await screen.findByText('決済金額（税込）を入力してください')).toBeInTheDocument()
      expect(bookingCall()).toBeUndefined()
    })

    it('マイナス金額は受け付けない', async () => {
      setup()
      fireEvent.change(amountInput(), { target: { value: '-100' } })
      fireEvent.click(confirmButton())

      expect(await screen.findByText('決済金額（税込）を入力してください')).toBeInTheDocument()
      expect(bookingCall()).toBeUndefined()
    })

    it('0円は有効な決済として受け付ける', async () => {
      const { onSuccess } = setup()
      fireEvent.change(amountInput(), { target: { value: '0' } })
      fireEvent.click(confirmButton())

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(0))
    })
  })

  describe('決済の確定', () => {
    it('booking関数へ complete_payment を送る', async () => {
      setup({ reservation: reservation({ id: 'res-9' }) })
      fireEvent.change(amountInput(), { target: { value: '7200' } })
      fireEvent.click(confirmButton())

      await waitFor(() => expect(bookingCall()).toBeDefined())
      expect(bookingCall()!.body).toMatchObject({
        action: 'complete_payment',
        store_id: STORE_ID,
        reservation_id: 'res-9',
        paid_amount: 7200,
        is_manual: true,
      })
    })

    it('画面で選び直したスタッフ・メニューを送る', async () => {
      setup()
      fireEvent.change(amountInput(), { target: { value: '5000' } })
      const selects = screen.getAllByRole('combobox')
      fireEvent.change(selects[0], { target: { value: 's1' } })
      fireEvent.change(selects[1], { target: { value: 'm2' } })
      fireEvent.click(confirmButton())

      await waitFor(() => expect(bookingCall()).toBeDefined())
      expect(bookingCall()!.body).toMatchObject({ staff_id: 's1', menu_id: 'm2' })
    })

    it('未指定のスタッフ・メニューは null で送る', async () => {
      setup()
      fireEvent.change(amountInput(), { target: { value: '5000' } })
      fireEvent.click(confirmButton())

      await waitFor(() => expect(bookingCall()).toBeDefined())
      expect(bookingCall()!.body).toMatchObject({ staff_id: null, menu_id: null })
    })

    it('成功したら決済金額を呼び出し元に返す', async () => {
      const { onSuccess } = setup()
      fireEvent.change(amountInput(), { target: { value: '12000' } })
      fireEvent.click(confirmButton())

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(12000))
    })
  })

  describe('失敗時', () => {
    it('関数がエラーを返したら画面に出し、成功扱いにしない', async () => {
      const { onSuccess } = setup({
        invoke: () => ({ data: null, error: { message: '予約が見つかりません' } }),
      })
      fireEvent.change(amountInput(), { target: { value: '5000' } })
      fireEvent.click(confirmButton())

      await waitFor(() => expect(screen.getByText(/予約が見つかりません/)).toBeInTheDocument())
      expect(onSuccess).not.toHaveBeenCalled()
    })

    it('本文に error が入っている場合も失敗として扱う', async () => {
      const { onSuccess } = setup({
        invoke: () => ({ data: { error: 'この予約は決済済みです' }, error: null }),
      })
      fireEvent.change(amountInput(), { target: { value: '5000' } })
      fireEvent.click(confirmButton())

      await waitFor(() => expect(screen.getByText('この予約は決済済みです')).toBeInTheDocument())
      expect(onSuccess).not.toHaveBeenCalled()
    })
  })
})
