import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ReservationCreateForm, type ReservationCreateFormProps } from './ReservationForm'
import type { Customer } from '../types'
import type { StoreMenu, StoreStaff } from '../../../types/storeResources'

const staffList: StoreStaff[] = [
  { id: 's1', name: '田中', role: null, image_url: null, is_active: true },
  { id: 's2', name: '佐藤', role: null, image_url: null, is_active: true },
]

const menuList: StoreMenu[] = [
  {
    id: 'm1',
    name: 'カット',
    description: null,
    price: 4000,
    duration_minutes: 60,
    capacity_per_slot: 1,
    is_active: true,
  },
  {
    id: 'm2',
    name: '相談',
    description: null,
    price: null,
    duration_minutes: 30,
    capacity_per_slot: 1,
    is_active: true,
  },
]

const customers: Customer[] = [
  { id: 'c1', line_user_id: 'U1', display_name: 'たろ', real_name: '山田 太郎', furigana: 'ヤマダ タロウ' } as Customer,
]


function renderForm(overrides: Partial<ReservationCreateFormProps> = {}) {
  const handlers = {
    onCustomerSearchChange: vi.fn(),
    onSelectedCustomerChange: vi.fn(),
    onIsNewCustomerChange: vi.fn(),
    onNewCustomerNameChange: vi.fn(),
    onNewCustomerFuriganaChange: vi.fn(),
    onCreateDateChange: vi.fn(),
    onCreateTimeChange: vi.fn(),
    onCreateStaffIdChange: vi.fn(),
    onCreateMenuIdChange: vi.fn(),
    onCreateQuotedAmountChange: vi.fn(),
    onCreateMemoChange: vi.fn(),
  }

  const props: ReservationCreateFormProps = {
    customerSearch: '',
    selectedCustomer: null,
    isNewCustomer: false,
    newCustomerName: '',
    newCustomerFurigana: '',
    createDate: '',
    createTime: '',
    createStaffId: '',
    createMenuId: '',
    createQuotedAmount: '',
    createMemo: '',
    availableSlots: [],
    loadingSlots: false,
    bookingSettings: {
      booking_enable_staff: true,
      booking_enable_menu: true,
      slot_interval_minutes: 30,
    },
    staffList,
    menuList,
    filteredCustomers: customers,
    ...handlers,
    ...overrides,
  }

  render(<ReservationCreateForm {...props} />)
  return handlers
}

const slotButton = (time: string) => screen.getByRole('button', { name: time })

describe('予約作成フォーム', () => {
  describe('空き枠の選択', () => {
    it('日付未選択なら案内を出す', () => {
      renderForm({ createDate: '' })
      expect(screen.getByText('日付を選択すると空き枠が表示されます')).toBeInTheDocument()
    })

    it('空き枠取得中はローディングを出す', () => {
      renderForm({ createDate: '2026-09-01', loadingSlots: true })
      expect(screen.getByText('空き枠を確認中...')).toBeInTheDocument()
    })

    it('枠が0件なら「予約可能な枠がありません」を出す', () => {
      renderForm({ createDate: '2026-09-01', availableSlots: [] })
      expect(screen.getByText('この日は予約可能な枠がありません')).toBeInTheDocument()
    })

    it('空いている枠を選ぶと時間を通知する', () => {
      const h = renderForm({
        createDate: '2026-09-01',
        availableSlots: [
          { time: '10:00', available: true },
          { time: '10:30', available: true },
        ],
      })

      fireEvent.click(slotButton('10:30'))
      expect(h.onCreateTimeChange).toHaveBeenCalledWith('10:30')
    })

    it('埋まっている枠は押せず、選択も通知しない', () => {
      const h = renderForm({
        createDate: '2026-09-01',
        availableSlots: [
          { time: '10:00', available: false },
          { time: '10:30', available: true },
        ],
      })

      expect(slotButton('10:00')).toBeDisabled()
      fireEvent.click(slotButton('10:00'))
      expect(h.onCreateTimeChange).not.toHaveBeenCalled()
    })

    it('選択中の時間を明示する', () => {
      renderForm({
        createDate: '2026-09-01',
        createTime: '10:30',
        availableSlots: [{ time: '10:30', available: true }],
      })
      expect(screen.getByText(/選択中: 10:30/)).toBeInTheDocument()
    })
  })

  describe('メニューと見込み金額', () => {
    it('メニューを選ぶと単価を見込み金額に自動入力する', () => {
      const h = renderForm()
      const selects = screen.getAllByRole('combobox')
      // 0=担当スタッフ, 1=メニュー
      fireEvent.change(selects[1], { target: { value: 'm1' } })

      expect(h.onCreateMenuIdChange).toHaveBeenCalledWith('m1')
      expect(h.onCreateQuotedAmountChange).toHaveBeenCalledWith('4000')
    })

    it('単価が無いメニューでは金額を自動入力しない', () => {
      const h = renderForm()
      const selects = screen.getAllByRole('combobox')

      fireEvent.change(selects[1], { target: { value: 'm2' } })

      expect(h.onCreateMenuIdChange).toHaveBeenCalledWith('m2')
      expect(h.onCreateQuotedAmountChange).not.toHaveBeenCalled()
    })

    it('メニュー未選択なら見込み金額を必須表示にする', () => {
      renderForm({ createMenuId: '' })
      const label = screen.getByText(/見込み金額（税込）/)
      expect(within(label).getByText('*')).toBeInTheDocument()
    })

    it('単価ありのメニューを選ぶと見込み金額欄自体を隠す（金額はメニュー単価で確定）', () => {
      renderForm({ createMenuId: 'm1', createQuotedAmount: '4000' })

      expect(screen.queryByText(/見込み金額（税込）/)).not.toBeInTheDocument()
      // 表示条件の都合で「メニュー単価: ...」の補足は到達不能になっている
      expect(screen.queryByText(/メニュー単価/)).not.toBeInTheDocument()
    })

    it('単価が無いメニューを選んだときは金額を手入力できる', () => {
      renderForm({ createMenuId: 'm2' })
      expect(screen.getByText(/見込み金額（税込）/)).toBeInTheDocument()
    })

    it('メニュー一覧に所要時間と価格を表示する', () => {
      renderForm()
      const selects = screen.getAllByRole('combobox')
      expect(within(selects[1]).getByText(/カット \(60分\) ¥4,000/)).toBeInTheDocument()
      expect(within(selects[1]).getByText(/相談 \(30分\)/)).toBeInTheDocument()
    })
  })

  describe('設定による出し分け', () => {
    it('スタッフ機能が無効なら担当スタッフ欄を出さない', () => {
      renderForm({
        bookingSettings: { booking_enable_staff: false, booking_enable_menu: true, slot_interval_minutes: 30 },
      })
      expect(screen.queryByText('担当スタッフ')).not.toBeInTheDocument()
    })

    it('メニュー機能が無効ならメニュー欄を出さない', () => {
      renderForm({
        bookingSettings: { booking_enable_staff: true, booking_enable_menu: false, slot_interval_minutes: 30 },
      })
      expect(screen.queryByText('メニュー')).not.toBeInTheDocument()
    })

    it('スタッフが未登録なら有効でも欄を出さない', () => {
      renderForm({ staffList: [] })
      expect(screen.queryByText('担当スタッフ')).not.toBeInTheDocument()
    })
  })

  describe('顧客の指定', () => {
    it('既存顧客の検索結果を選べる', () => {
      const h = renderForm({ customerSearch: '山田' })

      fireEvent.click(screen.getByRole('button', { name: /山田 太郎/ }))
      expect(h.onSelectedCustomerChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c1' }),
      )
    })

    it('新規顧客に切り替えると氏名欄を出す', () => {
      renderForm({ isNewCustomer: true })
      expect(screen.getByPlaceholderText('山田 太郎')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('ヤマダ タロウ')).toBeInTheDocument()
    })

    it('新規顧客タブを押すと選択済み顧客を解除する', () => {
      const h = renderForm({ selectedCustomer: customers[0] })

      fireEvent.click(screen.getByRole('button', { name: /新規/ }))
      expect(h.onIsNewCustomerChange).toHaveBeenCalledWith(true)
      expect(h.onSelectedCustomerChange).toHaveBeenCalledWith(null)
    })

    it('既存顧客タブを押すと新規入力を解除する', () => {
      const h = renderForm({ isNewCustomer: true })

      fireEvent.click(screen.getByRole('button', { name: /既存顧客から選択/ }))
      expect(h.onIsNewCustomerChange).toHaveBeenCalledWith(false)
      expect(h.onSelectedCustomerChange).toHaveBeenCalledWith(null)
    })
  })

  describe('メモ', () => {
    it('入力を親に伝える', () => {
      const h = renderForm()
      fireEvent.change(screen.getByPlaceholderText('予約に関するメモ（任意）'), {
        target: { value: '駐車場を使用' },
      })
      expect(h.onCreateMemoChange).toHaveBeenCalledWith('駐車場を使用')
    })
  })
})
