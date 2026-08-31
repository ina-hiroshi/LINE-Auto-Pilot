import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createSupabaseMock, type QueryOp, type QueryResult, type SupabaseMock } from '../../../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

// recharts は jsdom で幅0のため描画されない。集計結果の検証に集中する。
vi.mock('recharts', async () => {
  const React = await import('react')
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children)
  const Empty = () => null
  return {
    ResponsiveContainer: Passthrough,
    BarChart: Passthrough,
    Bar: Empty,
    XAxis: Empty,
    YAxis: Empty,
    CartesianGrid: Empty,
    Tooltip: Empty,
    Legend: Empty,
  }
})

import { SalesSummaryTab, toCsvField } from './SalesSummaryTab'

const STORE_ID = 'store-1'

type PaidRow = {
  id: string
  paid_amount: number | null
  paid_at: string | null
  menu_id: string | null
  staff_id: string | null
  menu: { name: string } | null
  staff: { name: string } | null
}

const paidRow = (over: Partial<PaidRow> & { id: string }): PaidRow => ({
  paid_amount: 5000,
  paid_at: '2026-08-10T02:00:00Z',
  menu_id: 'm1',
  staff_id: 's1',
  menu: { name: 'カット' },
  staff: { name: '田中' },
  ...over,
})

function setup(options: { paid?: PaidRow[]; unpaidCount?: number; plan?: string } = {}) {
  const { paid = [], unpaidCount = 0, plan = 'pro' } = options

  const handler = (op: QueryOp): QueryResult => {
    if (op.table === 'profiles') return { data: { plan }, error: null }
    if (op.table === 'reservations') {
      const isUnpaidCount = op.filters.some((f) => f.column === 'status' && f.value === 'confirmed')
      if (isUnpaidCount) return { data: null, error: null, count: unpaidCount }
      return { data: paid, error: null }
    }
    return { data: [], error: null }
  }

  mock = createSupabaseMock({ handler })
}

const renderTab = (storeId: string | null = STORE_ID) => render(<SalesSummaryTab storeId={storeId} />)

/** TOPリストの各行のテキスト（「1. カラー(1件)¥8,000」の形で分割描画される） */
const topListItems = (title: string) => {
  const card = screen.getByText(title).parentElement!
  return Array.from(card.querySelectorAll('li')).map((li) => li.textContent ?? '')
}

/** 見出しラベルから、その数値カードの値を取り出す */
const cardValue = (label: string | RegExp) => {
  const labelEl = screen.getByText(label)
  return labelEl.parentElement?.querySelector('p:last-child')?.textContent ?? ''
}

describe('売上サマリー', () => {
  describe('CSVフィールドのエスケープ', () => {
    it('通常の値は引用符で囲むだけ', () => {
      expect(toCsvField('カット')).toBe('"カット"')
      expect(toCsvField(5000)).toBe('"5000"')
    })

    it('カンマを含む名前で列がずれない', () => {
      expect(toCsvField('カット, カラー')).toBe('"カット, カラー"')
    })

    it('引用符を二重化する', () => {
      expect(toCsvField('スペシャル"限定"')).toBe('"スペシャル""限定"""')
    })

    it('改行を含んでも1フィールドに収まる', () => {
      expect(toCsvField('カット\nカラー')).toBe('"カット\nカラー"')
    })

    it('数式として解釈される先頭文字を無害化する', () => {
      // Excel / Sheets は = + - @ で始まる値を数式として実行する
      expect(toCsvField('=1+1')).toBe(`"'=1+1"`)
      expect(toCsvField('+HYPERLINK("http://x")')).toBe(`"'+HYPERLINK(""http://x"")"`)
      expect(toCsvField('-2')).toBe(`"'-2"`)
      expect(toCsvField('@SUM(A1)')).toBe(`"'@SUM(A1)"`)
    })

    it('null / undefined は空フィールドにする', () => {
      expect(toCsvField(null)).toBe('""')
      expect(toCsvField(undefined)).toBe('""')
    })
  })

  describe('集計', () => {
    it('決済済み予約の税込金額を合計する', async () => {
      setup({
        paid: [
          paidRow({ id: 'r1', paid_amount: 5000 }),
          paidRow({ id: 'r2', paid_amount: 12000 }),
          paidRow({ id: 'r3', paid_amount: 3000 }),
        ],
      })
      renderTab()

      await waitFor(() => expect(screen.getByText('今月の総売上')).toBeInTheDocument())
      expect(cardValue('今月の総売上')).toBe('¥20,000')
      expect(cardValue('決済完了件数')).toBe('3件')
    })

    it('paid_amount が未設定の予約は0として扱う', async () => {
      setup({ paid: [paidRow({ id: 'r1', paid_amount: null }), paidRow({ id: 'r2', paid_amount: 5000 })] })
      renderTab()

      await waitFor(() => expect(screen.getByText('今月の総売上')).toBeInTheDocument())
      expect(cardValue('今月の総売上')).toBe('¥5,000')
      expect(cardValue('決済完了件数')).toBe('2件')
    })

    it('未決済（confirmed）の件数を表示する', async () => {
      setup({ paid: [], unpaidCount: 7 })
      renderTab()

      await waitFor(() => expect(screen.getByText('未決済（全期間）')).toBeInTheDocument())
      expect(cardValue('未決済（全期間）')).toBe('7件')
    })

    it('メニュー別・スタッフ別に金額を集計して降順に並べる', async () => {
      setup({
        paid: [
          paidRow({ id: 'r1', paid_amount: 3000, menu: { name: 'カット' }, staff: { name: '田中' } }),
          paidRow({ id: 'r2', paid_amount: 8000, menu: { name: 'カラー' }, staff: { name: '佐藤' } }),
          paidRow({ id: 'r3', paid_amount: 2000, menu: { name: 'カット' }, staff: { name: '田中' } }),
        ],
      })
      renderTab()

      await waitFor(() => expect(screen.getByText('メニュー別 TOP')).toBeInTheDocument())

      const menu = topListItems('メニュー別 TOP')
      expect(menu[0]).toContain('カラー')
      expect(menu[0]).toContain('¥8,000')
      // カット は 3000 + 2000 で合算され、件数も2件になる
      expect(menu[1]).toContain('カット')
      expect(menu[1]).toContain('¥5,000')
      expect(menu[1]).toContain('(2件)')

      const staff = topListItems('スタッフ別 TOP')
      expect(staff[0]).toContain('佐藤')
      expect(staff[1]).toContain('田中')
    })

    it('メニュー・スタッフが未設定の売上は「未設定」にまとめる', async () => {
      setup({ paid: [paidRow({ id: 'r1', paid_amount: 4000, menu: null, staff: null })] })
      renderTab()

      await waitFor(() => expect(screen.getByText('メニュー別 TOP')).toBeInTheDocument())
      expect(topListItems('メニュー別 TOP')[0]).toContain('未設定')
      expect(topListItems('スタッフ別 TOP')[0]).toContain('未設定')
    })
  })

  describe('取得条件', () => {
    it('自店舗の決済済み予約だけを対象にする', async () => {
      setup({ paid: [paidRow({ id: 'r1' })] })
      renderTab()

      await waitFor(() => expect(mock.findOps('reservations', 'select').length).toBeGreaterThan(0))
      const salesOp = mock.findOps('reservations', 'select')[0]
      expect(salesOp.filters).toContainEqual({ op: 'eq', column: 'store_id', value: STORE_ID })
      expect(salesOp.filters).toContainEqual({ op: 'eq', column: 'status', value: 'paid' })
      expect(salesOp.filters.some((f) => f.op === 'gte' && f.column === 'paid_at')).toBe(true)
      expect(salesOp.filters.some((f) => f.op === 'lt' && f.column === 'paid_at')).toBe(true)
    })

    it('店舗が未確定なら問い合わせない', async () => {
      setup()
      renderTab(null)

      await waitFor(() => expect(screen.getByText('読み込み中...')).toBeInTheDocument())
      expect(mock.findOps('reservations')).toHaveLength(0)
    })
  })

  describe('プランによる出し分け', () => {
    it('Proなら期間指定とCSV出力を使える', async () => {
      setup({ plan: 'pro' })
      renderTab()

      await waitFor(() => expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument())
      expect(screen.getByRole('button', { name: '適用' })).toBeInTheDocument()
    })

    it('Freeなら期間指定・CSVを出さずアップグレード誘導を出す', async () => {
      setup({ plan: 'free' })
      renderTab()

      await waitFor(() => expect(screen.getByText('今月の総売上')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: 'CSV' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '適用' })).not.toBeInTheDocument()
      expect(screen.getByText(/Proプランで期間指定/)).toBeInTheDocument()
    })
  })
})
