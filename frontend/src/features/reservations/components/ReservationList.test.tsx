import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ReservationList, type ListFilter } from './ReservationList'
import type { Reservation } from '../types'

/** 2026-08-31（月）10:00 JST を「いま」とする */
const NOW = new Date('2026-08-31T01:00:00Z')

const at = (iso: string): string => iso

const reservation = (over: Partial<Reservation> & { id: string; start_time: string }): Reservation =>
  ({
    store_id: 'store-1',
    line_user_id: 'U1',
    end_time: over.start_time,
    status: 'confirmed',
    staff_id: null,
    menu_id: null,
    customer: { real_name: `客${over.id}`, display_name: null },
    ...over,
  }) as Reservation

const staffList = [{ id: 's1', name: '田中' }]

function renderList(options: { reservations: Reservation[]; listFilter?: ListFilter; loading?: boolean } = {
  reservations: [],
}) {
  const onListFilterChange = vi.fn()
  const onReservationClick = vi.fn()
  const onCancelClick = vi.fn()
  const onStaffFilterChange = vi.fn()

  render(
    <ReservationList
      reservations={options.reservations}
      listFilter={options.listFilter ?? 'all'}
      onListFilterChange={onListFilterChange}
      staffList={staffList}
      staffFilterId="all"
      onStaffFilterChange={onStaffFilterChange}
      loading={options.loading ?? false}
      onReservationClick={onReservationClick}
      onCancelClick={onCancelClick}
    />,
  )

  return { onListFilterChange, onReservationClick, onCancelClick, onStaffFilterChange }
}

/** 一覧に出ている顧客名 */
const shownCustomers = () =>
  Array.from(document.querySelectorAll('[class*="divide-y"] > div, li'))
    .map((el) => el.textContent ?? '')
    .filter((t) => t.includes('客'))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('予約一覧', () => {
  describe('期間フィルタ', () => {
    const fixture = [
      reservation({ id: '今日', start_time: at('2026-08-31T05:00:00Z') }), // 8/31 14:00 JST
      reservation({ id: '今週', start_time: at('2026-09-02T05:00:00Z') }), // 9/2（同じ週）
      reservation({ id: '今月', start_time: at('2026-08-05T05:00:00Z') }), // 8/5
      reservation({ id: '来月', start_time: at('2026-10-10T05:00:00Z') }), // 10/10
    ]

    it('all はすべて表示する', () => {
      renderList({ reservations: fixture, listFilter: 'all' })
      expect(screen.getByText(/客今日/)).toBeInTheDocument()
      expect(screen.getByText(/客来月/)).toBeInTheDocument()
    })

    it('today は当日分だけ表示する', () => {
      renderList({ reservations: fixture, listFilter: 'today' })
      expect(screen.getByText(/客今日/)).toBeInTheDocument()
      expect(screen.queryByText(/客今週/)).not.toBeInTheDocument()
      expect(screen.queryByText(/客今月/)).not.toBeInTheDocument()
    })

    it('month は同一年月だけ表示する', () => {
      renderList({ reservations: fixture, listFilter: 'month' })
      expect(screen.getByText(/客今日/)).toBeInTheDocument()
      expect(screen.getByText(/客今月/)).toBeInTheDocument()
      expect(screen.queryByText(/客来月/)).not.toBeInTheDocument()
    })

    it('unpaid は未決済（confirmed）だけを日付に関係なく表示する', () => {
      const rows = [
        reservation({ id: '未決済', start_time: at('2026-01-05T05:00:00Z'), status: 'confirmed' }),
        reservation({ id: '決済済', start_time: at('2026-08-31T05:00:00Z'), status: 'paid' }),
        reservation({ id: '取消', start_time: at('2026-08-31T06:00:00Z'), status: 'cancelled' }),
      ]
      renderList({ reservations: rows, listFilter: 'unpaid' })

      expect(screen.getByText(/客未決済/)).toBeInTheDocument()
      expect(screen.queryByText(/客決済済/)).not.toBeInTheDocument()
      expect(screen.queryByText(/客取消/)).not.toBeInTheDocument()
    })
  })

  describe('表示', () => {
    it('決済完了をラベル表示する', () => {
      renderList({
        reservations: [reservation({ id: 'A', start_time: at('2026-08-31T05:00:00Z'), status: 'paid' })],
      })

      expect(screen.getByText('決済完了')).toBeInTheDocument()
    })

    it('未決済をラベル表示する（絞り込みボタンとは別に行内にも出す）', () => {
      // 「未決済」は期間フィルタのボタン名でもあるため、件数で区別する
      const withoutRows = render(<div />)
      withoutRows.unmount()

      renderList({
        reservations: [reservation({ id: 'B', start_time: at('2026-08-31T06:00:00Z'), status: 'confirmed' })],
      })

      // フィルタボタンの1件 + 行内バッジの1件
      expect(screen.getAllByText('未決済')).toHaveLength(2)
    })

    it('予約が無ければ一覧に顧客行を出さない', () => {
      renderList({ reservations: [] })
      expect(shownCustomers()).toHaveLength(0)
    })
  })

  describe('操作', () => {
    it('行をクリックすると詳細を開く', () => {
      const row = reservation({ id: 'A', start_time: at('2026-08-31T05:00:00Z') })
      const { onReservationClick } = renderList({ reservations: [row] })

      fireEvent.click(screen.getByText(/客A/))
      expect(onReservationClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'A' }))
    })

    it('期間フィルタの変更を親に伝える', () => {
      const { onListFilterChange } = renderList({ reservations: [] })

      const unpaid = screen.getByRole('button', { name: /未決済/ })
      fireEvent.click(unpaid)
      expect(onListFilterChange).toHaveBeenCalledWith('unpaid')
    })

    it('スタッフ絞り込みの変更を親に伝える', () => {
      const { onStaffFilterChange } = renderList({ reservations: [] })

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 's1' } })
      expect(onStaffFilterChange).toHaveBeenCalledWith('s1')
    })

    it('スタッフ絞り込みに「担当なし」の選択肢を出す', () => {
      renderList({ reservations: [] })
      const select = screen.getByRole('combobox')
      expect(within(select).getByText(/担当なし|未割当|指定なし/)).toBeInTheDocument()
    })
  })
})
