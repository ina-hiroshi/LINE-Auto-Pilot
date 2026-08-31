import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createSupabaseMock, type QueryOp, type SupabaseMock } from '../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

// カメラを触るモーダルは一覧テストの対象外
vi.mock('../components/QRScannerModal', () => ({ default: () => null }))

import Customers from './Customers'

const STORE_ID = 'store-1'

type CustomerRow = {
  id: string
  line_user_id: string
  display_name: string | null
  real_name: string | null
  furigana: string | null
  profile_picture_url: string | null
}

const customerRow = (over: Partial<CustomerRow> & { id: string; line_user_id: string }): CustomerRow => ({
  display_name: null,
  real_name: null,
  furigana: null,
  profile_picture_url: null,
  ...over,
})

type Fixture = {
  customers: CustomerRow[]
  points: Array<{ line_user_id: string; balance: number }>
  reservations: Array<{ line_user_id: string; start_time: string }>
}

function setup(fixture: Partial<Fixture> = {}) {
  const data: Fixture = {
    customers: fixture.customers ?? [],
    points: fixture.points ?? [],
    reservations: fixture.reservations ?? [],
  }

  const handler = (op: QueryOp) => {
    switch (op.table) {
      case 'stores':
        return { data: [{ id: STORE_ID, membership_card_settings: null }], error: null }
      case 'customers':
        return { data: data.customers, error: null }
      case 'points':
        return { data: data.points, error: null }
      case 'reservations':
        // 呼び出し側が start_time 降順を要求している前提でそのまま返す
        return {
          data: [...data.reservations].sort((a, b) => b.start_time.localeCompare(a.start_time)),
          error: null,
        }
      default:
        return { data: null, error: null }
    }
  }

  mock = createSupabaseMock({ handler })
  return data
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/customers']}>
      <Customers />
    </MemoryRouter>,
  )

const typeSearch = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText('名前で検索...'), { target: { value } })

/** ヘッダー行を除いた顧客行を、表示順のまま返す */
const customerRows = () => {
  const table = screen.getByRole('table')
  const body = table.querySelectorAll('tbody tr')
  return Array.from(body)
}

describe('顧客一覧', () => {
  it('顧客が0件のときは空状態を出す', async () => {
    setup()
    renderPage()
    expect(await screen.findByText('顧客データがありません')).toBeInTheDocument()
  })

  it('本名を優先表示し、LINE名は別列に出す', async () => {
    setup({
      customers: [
        customerRow({ id: 'c1', line_user_id: 'U1', display_name: 'たろ', real_name: '山田 太郎', furigana: 'やまだ たろう' }),
      ],
    })
    renderPage()

    const row = await screen.findByRole('row', { name: /山田 太郎/ })
    expect(within(row).getByText('山田 太郎')).toBeInTheDocument()
    expect(within(row).getByText('たろ')).toBeInTheDocument()
    expect(within(row).getByText('やまだ たろう')).toBeInTheDocument()
  })

  it('本名未登録ならLINE表示名を名前欄に出し、LINE名列は "-" にする', async () => {
    setup({ customers: [customerRow({ id: 'c1', line_user_id: 'U1', display_name: 'たろ' })] })
    renderPage()

    const row = await screen.findByRole('row', { name: /たろ/ })
    expect(within(row).getByText('たろ')).toBeInTheDocument()
    // LINE名列・最終来店日列がともに未設定なので "-" が並ぶ
    expect(within(row).getAllByText('-').length).toBeGreaterThanOrEqual(1)
  })

  it('ポイント残高を line_user_id で突き合わせて表示する', async () => {
    setup({
      customers: [
        customerRow({ id: 'c1', line_user_id: 'U1', real_name: '山田 太郎' }),
        customerRow({ id: 'c2', line_user_id: 'U2', real_name: '鈴木 花子' }),
      ],
      points: [
        { line_user_id: 'U2', balance: 350 },
        { line_user_id: 'U1', balance: 1200 },
      ],
    })
    renderPage()

    const taro = await screen.findByRole('row', { name: /山田 太郎/ })
    const hanako = screen.getByRole('row', { name: /鈴木 花子/ })
    expect(within(taro).getByText('1,200 pt')).toBeInTheDocument()
    expect(within(hanako).getByText('350 pt')).toBeInTheDocument()
  })

  it('1000pt以上をVIP、それ未満を会員と判定する', async () => {
    setup({
      customers: [
        customerRow({ id: 'c1', line_user_id: 'U1', real_name: 'VIP候補' }),
        customerRow({ id: 'c2', line_user_id: 'U2', real_name: '境界未満' }),
      ],
      points: [
        { line_user_id: 'U1', balance: 1000 },
        { line_user_id: 'U2', balance: 999 },
      ],
    })
    renderPage()

    const vip = await screen.findByRole('row', { name: /VIP候補/ })
    const member = screen.getByRole('row', { name: /境界未満/ })
    expect(within(vip).getByText('VIP')).toBeInTheDocument()
    expect(within(member).getByText('会員')).toBeInTheDocument()
  })

  it('ポイントレコードが無い顧客は 0pt 扱いにする', async () => {
    setup({ customers: [customerRow({ id: 'c1', line_user_id: 'U1', real_name: '新規さん' })] })
    renderPage()

    const row = await screen.findByRole('row', { name: /新規さん/ })
    expect(within(row).getByText('0 pt')).toBeInTheDocument()
  })

  it('最終来店日の新しい順に並べ、未来店の顧客を末尾に置く', async () => {
    setup({
      customers: [
        customerRow({ id: 'c1', line_user_id: 'U1', real_name: '未来店' }),
        customerRow({ id: 'c2', line_user_id: 'U2', real_name: '古い来店' }),
        customerRow({ id: 'c3', line_user_id: 'U3', real_name: '最近来店' }),
      ],
      reservations: [
        { line_user_id: 'U2', start_time: '2026-01-05T02:00:00Z' },
        { line_user_id: 'U3', start_time: '2026-08-20T02:00:00Z' },
      ],
    })
    renderPage()

    await screen.findByRole('row', { name: /最近来店/ })
    const names = customerRows().map((r) => r.textContent ?? '')
    expect(names[0]).toContain('最近来店')
    expect(names[1]).toContain('古い来店')
    expect(names[2]).toContain('未来店')
  })

  it('来店履歴の取得はキャンセル済みを除外し、過去分だけに限定する', async () => {
    setup({ customers: [customerRow({ id: 'c1', line_user_id: 'U1', real_name: '山田 太郎' })] })
    renderPage()
    await screen.findByRole('row', { name: /山田 太郎/ })

    const resOp = mock.findOps('reservations', 'select')[0]
    expect(resOp).toBeDefined()
    expect(resOp.filters).toContainEqual({ op: 'eq', column: 'store_id', value: STORE_ID })
    expect(resOp.filters).toContainEqual({ op: 'neq', column: 'status', value: 'cancelled' })
    expect(resOp.filters.some((f) => f.op === 'lt' && f.column === 'start_time')).toBe(true)
  })

  it('顧客・ポイント・予約のいずれも自店舗の store_id で絞り込む', async () => {
    setup({ customers: [customerRow({ id: 'c1', line_user_id: 'U1', real_name: '山田 太郎' })] })
    renderPage()
    await screen.findByRole('row', { name: /山田 太郎/ })

    for (const table of ['customers', 'points', 'reservations']) {
      const op = mock.findOps(table, 'select')[0]
      expect(op, `${table} の取得が行われていない`).toBeDefined()
      expect(op.filters, `${table} が store_id で絞られていない`).toContainEqual({
        op: 'eq',
        column: 'store_id',
        value: STORE_ID,
      })
    }
  })

  describe('検索', () => {
    const fixture = {
      customers: [
        customerRow({ id: 'c1', line_user_id: 'U1', display_name: 'たろ', real_name: '山田 太郎', furigana: 'やまだ たろう' }),
        customerRow({ id: 'c2', line_user_id: 'U2', display_name: 'Hanako', real_name: '鈴木 花子', furigana: 'すずき はなこ' }),
      ],
    }

    it('本名で絞り込める', async () => {
      setup(fixture)
      renderPage()
      await screen.findByRole('row', { name: /山田 太郎/ })

      typeSearch('鈴木')
      await waitFor(() => expect(customerRows()).toHaveLength(1))
      expect(screen.getByRole('row', { name: /鈴木 花子/ })).toBeInTheDocument()
    })

    it('ふりがなで絞り込める', async () => {
      setup(fixture)
      renderPage()
      await screen.findByRole('row', { name: /山田 太郎/ })

      typeSearch('やまだ')
      await waitFor(() => expect(customerRows()).toHaveLength(1))
      expect(screen.getByRole('row', { name: /山田 太郎/ })).toBeInTheDocument()
    })

    it('LINE表示名は大文字小文字を区別せずに絞り込める', async () => {
      setup(fixture)
      renderPage()
      await screen.findByRole('row', { name: /山田 太郎/ })

      typeSearch('hanako')
      await waitFor(() => expect(customerRows()).toHaveLength(1))
      expect(screen.getByRole('row', { name: /鈴木 花子/ })).toBeInTheDocument()
    })

    it('該当なしのときは専用メッセージを出す', async () => {
      setup(fixture)
      renderPage()
      await screen.findByRole('row', { name: /山田 太郎/ })

      typeSearch('いない人')
      expect(await screen.findByText('該当する顧客が見つかりません')).toBeInTheDocument()
    })
  })

  it('顧客の取得に失敗したら、空一覧と区別できるエラーを表示する', async () => {
    mock = createSupabaseMock({
      handler: (op: QueryOp) => {
        if (op.table === 'stores') return { data: [{ id: STORE_ID, membership_card_settings: null }], error: null }
        if (op.table === 'customers') return { data: null, error: { message: 'permission denied' } }
        return { data: [], error: null }
      },
    })
    renderPage()

    expect(await screen.findByText(/取得に失敗/)).toBeInTheDocument()
    expect(screen.queryByText('顧客データがありません')).not.toBeInTheDocument()
  })
})
