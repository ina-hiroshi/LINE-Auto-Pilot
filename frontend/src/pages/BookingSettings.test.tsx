import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createSupabaseMock, type QueryOp, type QueryResult, type SupabaseMock } from '../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import BookingSettings from './BookingSettings'

const OWNER_ID = 'owner-1'
const STORE_ID = 'store-1'

type StaffRow = { id: string; store_id: string; name: string; is_active: boolean }
type MenuRow = {
  id: string
  store_id: string
  name: string
  description: string | null
  price: number
  duration_minutes: number
  capacity_per_slot: number
  is_active: boolean
}

const storeRow = (over: Record<string, unknown> = {}) => ({
  id: STORE_ID,
  owner_id: OWNER_ID,
  liff_template_id: 'simple',
  liff_theme_color: '#00c3dc',
  liff_logo_url: '',
  booking_system_type: 'salon',
  slot_interval_minutes: 30,
  capacity_per_slot: 1,
  max_booking_days: 60,
  business_hours: null,
  booking_enable_party_size: false,
  booking_enable_staff: true,
  booking_enable_menu: true,
  ...over,
})

type SetupOptions = {
  store?: Record<string, unknown> | null
  staff?: StaffRow[]
  menus?: MenuRow[]
  plan?: string
}

function setup(options: SetupOptions = {}) {
  const { store = storeRow(), staff = [], menus = [], plan = 'pro' } = options

  const handler = (op: QueryOp): QueryResult => {
    switch (op.table) {
      case 'profiles':
        return { data: { plan }, error: null }
      case 'stores':
        if (op.method === 'select') return { data: store ? [store] : [], error: null }
        return { data: null, error: null }
      case 'staff_members':
        return op.method === 'select' ? { data: staff, error: null } : { data: null, error: null }
      case 'booking_menus':
        return op.method === 'select' ? { data: menus, error: null } : { data: null, error: null }
      case 'booking_special_dates':
        return { data: [], error: null }
      default:
        return { data: [], error: null }
    }
  }

  mock = createSupabaseMock({ user: { id: OWNER_ID }, handler })
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/booking-settings']}>
      <BookingSettings />
    </MemoryRouter>,
  )

const lastWrite = (table: string) =>
  mock.ops.filter((o) => o.table === table && o.method !== 'select').at(-1)

/** スタッフ・メニューは「メニュー・スタッフ登録」タブ配下にある */
const openItemsTab = async () => {
  const tab = await screen.findByRole('button', { name: /メニュー・スタッフ登録/ })
  fireEvent.click(tab)
  await screen.findByText('スタッフ管理')
}

/** スタッフ/メニューの「+ 追加」ボタン（DOM順: 0=スタッフ, 1=メニュー） */
const addButtons = () => screen.getAllByRole('button', { name: /\+ 追加/ })

describe('予約設定', () => {
  describe('読み込み', () => {
    it('自店舗の設定・スタッフ・メニューを store_id で取得する', async () => {
      setup({
        staff: [{ id: 's1', store_id: STORE_ID, name: '田中', is_active: true }],
        menus: [
          {
            id: 'm1',
            store_id: STORE_ID,
            name: 'カット',
            description: null,
            price: 4000,
            duration_minutes: 60,
            capacity_per_slot: 1,
            is_active: true,
          },
        ],
      })
      renderPage()
      await openItemsTab()

      expect(screen.getByText('田中')).toBeInTheDocument()
      expect(screen.getByText('カット')).toBeInTheDocument()

      const storeOp = mock.findOps('stores', 'select')[0]
      expect(storeOp.filters).toContainEqual({ op: 'eq', column: 'owner_id', value: OWNER_ID })

      for (const table of ['staff_members', 'booking_menus']) {
        const op = mock.findOps(table, 'select')[0]
        expect(op, `${table} を取得していない`).toBeDefined()
        expect(op.filters).toContainEqual({ op: 'eq', column: 'store_id', value: STORE_ID })
      }
    })
  })

  describe('予約ページ設定の保存', () => {
    it('自店舗の stores を更新し、予約受付の設定値を送る', async () => {
      setup()
      renderPage()
      await screen.findByRole('button', { name: /設定を保存/ })

      fireEvent.click(screen.getByRole('button', { name: /設定を保存/ }))

      await waitFor(() => expect(lastWrite('stores')?.method).toBe('update'))
      const write = lastWrite('stores')!
      expect(write.filters).toContainEqual({ op: 'eq', column: 'id', value: STORE_ID })
      expect(write.payload).toMatchObject({
        booking_system_type: 'salon',
        slot_interval_minutes: 30,
        capacity_per_slot: 1,
        max_booking_days: 60,
        booking_enable_staff: true,
        booking_enable_menu: true,
      })
    })

    it('保存の完了を通知する', async () => {
      setup()
      renderPage()
      await screen.findByRole('button', { name: /設定を保存/ })

      fireEvent.click(screen.getByRole('button', { name: /設定を保存/ }))
      expect(await screen.findByText('予約ページ設定を保存しました')).toBeInTheDocument()
    })
  })

  describe('スタッフ', () => {
    it('追加したスタッフは自店舗に紐づけて登録する', async () => {
      setup()
      renderPage()
      await openItemsTab()

      fireEvent.click(addButtons()[0])
      const nameInput = await screen.findByPlaceholderText('例: 山田 花子')
      fireEvent.change(nameInput, { target: { value: '佐藤' } })
      fireEvent.click(screen.getByRole('button', { name: '追加' }))

      await waitFor(() => expect(lastWrite('staff_members')?.method).toBe('insert'))
      expect(lastWrite('staff_members')!.payload).toMatchObject({
        store_id: STORE_ID,
        name: '佐藤',
      })
    })

    it('編集は id と store_id の両方で対象を絞る', async () => {
      setup({ staff: [{ id: 's1', store_id: STORE_ID, name: '田中', is_active: true }] })
      renderPage()
      await openItemsTab()

      // アイコンのみのボタンには名前が無いため、スタッフ行の操作ボタンを直接引く
      const row = screen.getByText('田中').closest('div.flex.items-center')?.parentElement
      const buttons = row?.querySelectorAll('button') ?? []
      fireEvent.click(buttons[0])

      const nameInput = await screen.findByPlaceholderText('例: 山田 花子')
      fireEvent.change(nameInput, { target: { value: '田中 太郎' } })
      fireEvent.click(screen.getByRole('button', { name: '更新' }))

      await waitFor(() => expect(lastWrite('staff_members')?.method).toBe('update'))
      const write = lastWrite('staff_members')!
      expect(write.filters).toContainEqual({ op: 'eq', column: 'id', value: 's1' })
      expect(write.filters).toContainEqual({ op: 'eq', column: 'store_id', value: STORE_ID })
    })
  })

  describe('メニュー', () => {
    it('追加したメニューは自店舗に紐づけて登録する', async () => {
      setup()
      renderPage()
      await openItemsTab()

      fireEvent.click(addButtons()[1])
      const nameInput = await screen.findByPlaceholderText('例: カット & カラー')
      fireEvent.change(nameInput, { target: { value: 'カラー' } })
      fireEvent.click(screen.getByRole('button', { name: '追加' }))

      await waitFor(() => expect(lastWrite('booking_menus')?.method).toBe('insert'))
      expect(lastWrite('booking_menus')!.payload).toMatchObject({
        store_id: STORE_ID,
        name: 'カラー',
      })
    })
  })
})
