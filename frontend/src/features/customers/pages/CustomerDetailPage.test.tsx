import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createSupabaseMock, type QueryOp, type QueryResult, type SupabaseMock } from '../../../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import CustomerDetailPage from './CustomerDetailPage'

const OWNER_ID = 'owner-1'
const STORE_ID = 'store-1'
const CUSTOMER_ID = 'cust-1'

type CustomerRow = {
  id: string
  store_id: string
  line_user_id: string
  display_name: string | null
  real_name: string | null
  furigana: string | null
  notes: string | null
  profile_picture_url: string | null
}

const customerRow = (over: Partial<CustomerRow> = {}): CustomerRow => ({
  id: CUSTOMER_ID,
  store_id: STORE_ID,
  line_user_id: 'U1',
  display_name: 'たろ',
  real_name: '山田 太郎',
  furigana: 'やまだ たろう',
  notes: 'アレルギーあり',
  profile_picture_url: null,
  ...over,
})

type SetupOptions = {
  customer?: CustomerRow | null
  hasLineAccount?: boolean
  balance?: number
  stores?: Array<{ id: string; membership_card_settings: unknown }>
}

function setup(options: SetupOptions = {}) {
  const {
    customer = customerRow(),
    hasLineAccount = true,
    balance = 250,
    stores = [{ id: STORE_ID, membership_card_settings: { card_type: 'point' } }],
  } = options

  const handler = (op: QueryOp): QueryResult => {
    switch (op.table) {
      case 'stores':
        return { data: stores, error: null }
      case 'line_accounts':
        return { data: hasLineAccount ? { id: 'la-1' } : null, error: null }
      case 'customers':
        if (op.method === 'select') return { data: customer, error: null }
        return { data: null, error: null }
      case 'points':
        return { data: { balance }, error: null }
      case 'reservations':
        return { data: null, error: null }
      default:
        return { data: [], error: null }
    }
  }

  mock = createSupabaseMock({ user: { id: OWNER_ID }, handler })
}

const renderPage = (search = '') =>
  render(
    <MemoryRouter initialEntries={[`/customers/${CUSTOMER_ID}${search}`]}>
      <Routes>
        <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )

const tab = (label: string) => screen.getByRole('button', { name: new RegExp(label) })

/**
 * editForm は customer 取得後の useEffect で初期化される。
 * 見出しの描画だけを待って保存を押すと、反映前の空フォームを送ってしまう。
 */
const waitForEditFormReady = async (realName: string) => {
  const input = screen.getByPlaceholderText('山田 太郎') as HTMLInputElement
  await waitFor(() => expect(input.value).toBe(realName))
}

describe('顧客詳細', () => {
  describe('読み込み', () => {
    it('顧客と店舗を自分の所有店舗スコープで取得する', async () => {
      setup()
      renderPage()

      await screen.findByText('顧客詳細')

      const storeOp = mock.findOps('stores', 'select')[0]
      expect(storeOp.filters).toContainEqual({ op: 'eq', column: 'owner_id', value: OWNER_ID })

      const custOp = mock.findOps('customers', 'select')[0]
      expect(custOp.filters).toContainEqual({ op: 'eq', column: 'store_id', value: STORE_ID })
      expect(custOp.filters).toContainEqual({ op: 'eq', column: 'id', value: CUSTOMER_ID })
    })

    it('他店舗の顧客IDを指定しても「顧客が見つかりません」になる', async () => {
      // customers 取得が store_id で絞られている以上、他店舗のIDでは行が返らない
      setup({ customer: null })
      renderPage()

      expect(await screen.findByText('顧客が見つかりません')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '顧客一覧に戻る' })).toBeInTheDocument()
    })

    it('店舗が未登録なら顧客詳細を出さずにエラーを表示する', async () => {
      setup({ stores: [] })
      renderPage()

      expect(await screen.findByText('店舗が見つかりません')).toBeInTheDocument()
    })

    it('ポイント残高を自店舗・当該LINEユーザーで取得する', async () => {
      setup({ balance: 250 })
      renderPage()
      await screen.findByText('顧客詳細')

      const pointsOp = mock.findOps('points', 'select')[0]
      expect(pointsOp.filters).toContainEqual({ op: 'eq', column: 'store_id', value: STORE_ID })
      expect(pointsOp.filters).toContainEqual({ op: 'eq', column: 'line_user_id', value: 'U1' })
    })
  })

  describe('メッセージタブの出し分け', () => {
    it('LINE連携済み かつ LINE顧客なら表示する', async () => {
      setup({ hasLineAccount: true, customer: customerRow({ line_user_id: 'U1' }) })
      renderPage()
      await screen.findByText('顧客詳細')

      expect(tab('メッセージ')).toBeInTheDocument()
    })

    it('LINE未連携なら表示しない', async () => {
      setup({ hasLineAccount: false })
      renderPage()
      await screen.findByText('顧客詳細')

      expect(screen.queryByRole('button', { name: /メッセージ/ })).not.toBeInTheDocument()
    })

    it('手動登録（MANUAL_ 接頭辞）の顧客には表示しない', async () => {
      setup({ hasLineAccount: true, customer: customerRow({ line_user_id: 'MANUAL_1735689600000' }) })
      renderPage()
      await screen.findByText('顧客詳細')

      expect(screen.queryByRole('button', { name: /メッセージ/ })).not.toBeInTheDocument()
    })
  })

  describe('顧客情報の保存', () => {
    it('顧客ID と store_id の両方で対象を絞って更新する', async () => {
      setup()
      renderPage()
      await screen.findByText('顧客詳細')
      await waitForEditFormReady('山田 太郎')

      fireEvent.click(screen.getByRole('button', { name: /保存/ }))

      await waitFor(() => expect(mock.findOps('customers', 'update')).toHaveLength(1))
      const updateOp = mock.findOps('customers', 'update')[0]
      // id だけで絞ると、RLS を唯一の防波堤にすることになる。店舗スコープも明示する。
      expect(updateOp.filters).toContainEqual({ op: 'eq', column: 'id', value: CUSTOMER_ID })
      expect(updateOp.filters).toContainEqual({ op: 'eq', column: 'store_id', value: STORE_ID })
    })

    it('入力済みの本名・ふりがな・メモを送信する', async () => {
      setup()
      renderPage()
      await screen.findByText('顧客詳細')
      await waitForEditFormReady('山田 太郎')

      fireEvent.click(screen.getByRole('button', { name: /保存/ }))

      await waitFor(() => expect(mock.findOps('customers', 'update')).toHaveLength(1))
      expect(mock.findOps('customers', 'update')[0].payload).toMatchObject({
        real_name: '山田 太郎',
        furigana: 'やまだ たろう',
        notes: 'アレルギーあり',
      })
    })

    it('空欄で保存した項目は null にする（空文字を残さない）', async () => {
      setup({ customer: customerRow({ real_name: '', furigana: '', notes: '' }) })
      renderPage()
      await screen.findByText('顧客詳細')
      await waitForEditFormReady('')

      fireEvent.click(screen.getByRole('button', { name: /保存/ }))

      await waitFor(() => expect(mock.findOps('customers', 'update')).toHaveLength(1))
      expect(mock.findOps('customers', 'update')[0].payload).toMatchObject({
        real_name: null,
        furigana: null,
        notes: null,
      })
    })
  })
})
