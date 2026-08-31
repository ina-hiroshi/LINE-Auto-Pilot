import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createSupabaseMock, type QueryHandler, type QueryOp, type SupabaseMock } from '../../../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import { StaffShiftTab } from './StaffShiftTab'

const STORE = 'store-1'
const STAFF = { id: 'staff-1', name: '田中' }

type Pattern = {
  id: string
  staff_id: string
  day_of_week: number
  slots?: { start: string; end: string }[] | null
  start_time: string | null
  end_time: string | null
  is_active: boolean
}

const pattern = (over: Partial<Pattern> & { id: string; day_of_week: number }): Pattern => ({
  staff_id: STAFF.id,
  slots: null,
  start_time: '10:00',
  end_time: '19:00',
  is_active: true,
  ...over,
})

function setup(options: {
  patterns?: Pattern[]
  businessHours?: unknown
  staffList?: { id: string; name: string }[]
  patternError?: unknown
} = {}) {
  const {
    patterns = [],
    businessHours = { mon: [{ start: '09:00', end: '18:00' }] },
    staffList = [STAFF],
    patternError = null,
  } = options

  let insertSeq = 0
  const handler: QueryHandler = (op: QueryOp) => {
    if (op.table === 'stores') return { data: { business_hours: businessHours }, error: null }
    if (op.table === 'booking_special_dates') return { data: [], error: null }
    if (op.table === 'staff_special_schedules') return { data: [], error: null }
    if (op.table === 'staff_work_patterns') {
      if (op.method === 'insert') {
        if (patternError) return { data: null, error: patternError }
        const payload = op.payload as Record<string, unknown> | Record<string, unknown>[]
        const rows = (Array.isArray(payload) ? payload : [payload]).map((p) => ({
          id: `new-${++insertSeq}`,
          ...p,
        }))
        return { data: op.cardinality === 'single' ? rows[0] : rows, error: null }
      }
      if (op.method === 'update') return { data: null, error: patternError }
      return { data: patterns, error: null }
    }
    return { data: null, error: null }
  }

  mock = createSupabaseMock({ handler })

  const onToast = vi.fn()
  const onDataChange = vi.fn()
  render(
    <StaffShiftTab storeId={STORE} staffList={staffList} onToast={onToast} onDataChange={onDataChange} />,
  )
  return { onToast, onDataChange }
}

/** 曜日ブロック */
const dayBlock = (label: string) => {
  const el = screen.getByText(label).closest('.p-3')
  if (!el) throw new Error(`${label} が見つからない`)
  return within(el as HTMLElement)
}

const timeInputs = (label: string) =>
  (dayBlock(label).getAllByDisplayValue(/^\d{2}:\d{2}$/) as HTMLInputElement[])

describe('スタッフのシフト設定', () => {
  describe('表示', () => {
    it('スタッフ未登録なら登録を促す', () => {
      setup({ staffList: [] })
      expect(screen.getByText('スタッフが登録されていません')).toBeInTheDocument()
    })

    it('7曜日を日曜始まりで並べる', async () => {
      setup()
      await waitFor(() => expect(screen.getByText('日曜日')).toBeInTheDocument())
      for (const d of ['日', '月', '火', '水', '木', '金', '土']) {
        expect(screen.getByText(`${d}曜日`)).toBeInTheDocument()
      }
    })

    it('パターンが無い曜日は休業として出す', async () => {
      setup()
      await waitFor(() => expect(screen.getAllByText('定休日')).toHaveLength(7))
    })

    it('slots が無い旧データは start_time / end_time から1枠として表示する', async () => {
      setup({ patterns: [pattern({ id: 'p1', day_of_week: 1, start_time: '11:00', end_time: '20:00' })] })
      await waitFor(() => expect(dayBlock('月曜日').getByDisplayValue('11:00')).toBeInTheDocument())
      expect(dayBlock('月曜日').getByDisplayValue('20:00')).toBeInTheDocument()
    })

    it('出勤オフのパターンは定休日として出す', async () => {
      setup({ patterns: [pattern({ id: 'p1', day_of_week: 1, is_active: false })] })
      await waitFor(() => expect(screen.getAllByText('定休日')).toHaveLength(7))
    })
  })

  describe('出勤の切り替え', () => {
    it('未登録の曜日をオンにすると営業時間を初期値として登録する', async () => {
      const { onDataChange } = setup({ businessHours: { mon: [{ start: '09:00', end: '18:00' }] } })
      await waitFor(() => expect(screen.getAllByText('定休日')).toHaveLength(7))

      fireEvent.click(dayBlock('月曜日').getByRole('checkbox'))

      await waitFor(() => expect(mock.findOps('staff_work_patterns', 'insert')).toHaveLength(1))
      const payload = mock.findOps('staff_work_patterns', 'insert')[0].payload as Record<string, unknown>
      expect(payload).toMatchObject({
        staff_id: STAFF.id,
        day_of_week: 1,
        start_time: '09:00',
        end_time: '18:00',
        is_active: true,
      })
      expect(onDataChange).toHaveBeenCalled()
    })

    it('営業時間が未設定の曜日は 10:00-19:00 を初期値にする', async () => {
      setup({ businessHours: {} })
      await waitFor(() => expect(screen.getAllByText('定休日')).toHaveLength(7))

      fireEvent.click(dayBlock('火曜日').getByRole('checkbox'))

      await waitFor(() => expect(mock.findOps('staff_work_patterns', 'insert')).toHaveLength(1))
      const payload = mock.findOps('staff_work_patterns', 'insert')[0].payload as Record<string, unknown>
      expect(payload).toMatchObject({ start_time: '10:00', end_time: '19:00' })
    })

    it('既存パターンのオンオフは is_active だけを更新する', async () => {
      setup({ patterns: [pattern({ id: 'p1', day_of_week: 1 })] })
      await waitFor(() => expect(dayBlock('月曜日').getByText('出勤')).toBeInTheDocument())

      fireEvent.click(dayBlock('月曜日').getByRole('checkbox'))

      await waitFor(() => expect(mock.findOps('staff_work_patterns', 'update')).toHaveLength(1))
      const op = mock.findOps('staff_work_patterns', 'update')[0]
      expect(op.payload).toEqual({ is_active: false })
      expect(mock.filterValue(op, 'id')).toBe('p1')
    })

    it('登録に失敗したら通知する', async () => {
      const { onToast } = setup({ patternError: { message: 'permission denied' } })
      await waitFor(() => expect(screen.getAllByText('定休日')).toHaveLength(7))

      fireEvent.click(dayBlock('月曜日').getByRole('checkbox'))
      await waitFor(() => expect(onToast).toHaveBeenCalledWith('更新に失敗しました', 'error'))
    })
  })

  describe('時間枠の編集', () => {
    it('時刻の変更を slots と start_time の両方に書く', async () => {
      setup({ patterns: [pattern({ id: 'p1', day_of_week: 1, slots: [{ start: '10:00', end: '19:00' }] })] })
      await waitFor(() => expect(dayBlock('月曜日').getByDisplayValue('10:00')).toBeInTheDocument())

      fireEvent.change(dayBlock('月曜日').getByDisplayValue('10:00'), { target: { value: '11:30' } })

      await waitFor(() => expect(mock.findOps('staff_work_patterns', 'update')).toHaveLength(1))
      expect(mock.findOps('staff_work_patterns', 'update')[0].payload).toEqual({
        slots: [{ start: '11:30', end: '19:00' }],
        start_time: '11:30',
        end_time: '19:00',
      })
    })

    it('枠を追加すると2枠目が入る', async () => {
      setup({ patterns: [pattern({ id: 'p1', day_of_week: 1, slots: [{ start: '10:00', end: '13:00' }] })] })
      await waitFor(() => expect(dayBlock('月曜日').getByDisplayValue('10:00')).toBeInTheDocument())

      fireEvent.click(dayBlock('月曜日').getByRole('button', { name: /枠を追加/ }))

      await waitFor(() => expect(mock.findOps('staff_work_patterns', 'update')).toHaveLength(1))
      const payload = mock.findOps('staff_work_patterns', 'update')[0].payload as { slots: unknown[] }
      expect(payload.slots).toHaveLength(2)
    })

    it('枠が1つだけのときは削除させず、出勤オフを案内する', async () => {
      const { onToast } = setup({
        patterns: [pattern({ id: 'p1', day_of_week: 1, slots: [{ start: '10:00', end: '19:00' }] })],
      })
      await waitFor(() => expect(dayBlock('月曜日').getByDisplayValue('10:00')).toBeInTheDocument())

      fireEvent.click(dayBlock('月曜日').getByTitle('削除'))

      expect(onToast).toHaveBeenCalledWith(
        '少なくとも1つの時間枠が必要です。休みにする場合は「出勤」をオフにしてください',
        'error',
      )
      expect(mock.findOps('staff_work_patterns', 'update')).toHaveLength(0)
    })

    it('2枠あれば指定した枠だけ削除する', async () => {
      setup({
        patterns: [pattern({
          id: 'p1', day_of_week: 1,
          slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
        })],
      })
      await waitFor(() => expect(dayBlock('月曜日').getByDisplayValue('09:00')).toBeInTheDocument())

      fireEvent.click(dayBlock('月曜日').getAllByTitle('削除')[0])

      await waitFor(() => expect(mock.findOps('staff_work_patterns', 'update')).toHaveLength(1))
      expect(mock.findOps('staff_work_patterns', 'update')[0].payload).toEqual({
        slots: [{ start: '14:00', end: '18:00' }],
        start_time: '14:00',
        end_time: '18:00',
      })
    })
  })

  describe('全曜日にコピー', () => {
    it('未登録の曜日はまとめて登録する', async () => {
      setup({ patterns: [pattern({ id: 'p1', day_of_week: 1, slots: [{ start: '11:00', end: '20:00' }] })] })
      await waitFor(() => expect(dayBlock('月曜日').getByDisplayValue('11:00')).toBeInTheDocument())

      fireEvent.click(dayBlock('月曜日').getByRole('button', { name: /全曜日にコピー/ }))

      await waitFor(() => expect(mock.findOps('staff_work_patterns', 'insert')).toHaveLength(1))
      const rows = mock.findOps('staff_work_patterns', 'insert')[0].payload as Record<string, unknown>[]
      expect(rows).toHaveLength(6)
      expect(rows.map((r) => r.day_of_week).sort()).toEqual([0, 2, 3, 4, 5, 6])
      expect(rows[0]).toMatchObject({ start_time: '11:00', end_time: '20:00', is_active: true })
    })

    it('既存の曜日は更新する', async () => {
      setup({
        patterns: [
          pattern({ id: 'p1', day_of_week: 1, slots: [{ start: '11:00', end: '20:00' }] }),
          pattern({ id: 'p2', day_of_week: 2, slots: [{ start: '08:00', end: '12:00' }] }),
        ],
      })
      await waitFor(() => expect(dayBlock('月曜日').getByDisplayValue('11:00')).toBeInTheDocument())

      fireEvent.click(dayBlock('月曜日').getByRole('button', { name: /全曜日にコピー/ }))

      await waitFor(() => expect(mock.findOps('staff_work_patterns', 'update').length).toBeGreaterThan(0))
      const updated = mock.findOps('staff_work_patterns', 'update')
        .find((op) => mock.filterValue(op, 'id') === 'p2')
      expect(updated!.payload).toMatchObject({ start_time: '11:00', end_time: '20:00' })
    })

    it('コピー後に1曜日の時刻を変えても他曜日の表示は変わらない', async () => {
      setup({ patterns: [pattern({ id: 'p1', day_of_week: 1, slots: [{ start: '11:00', end: '20:00' }] })] })
      await waitFor(() => expect(dayBlock('月曜日').getByDisplayValue('11:00')).toBeInTheDocument())

      fireEvent.click(dayBlock('月曜日').getByRole('button', { name: /全曜日にコピー/ }))
      await waitFor(() => expect(timeInputs('火曜日')[0].value).toBe('11:00'))

      // 月曜だけを 13:00 にする（DB更新も月曜のみ）
      fireEvent.change(timeInputs('月曜日')[0], { target: { value: '13:00' } })

      await waitFor(() => expect(timeInputs('月曜日')[0].value).toBe('13:00'))
      // 枠オブジェクトを共有していると、ここが 13:00 に化けて保存内容と食い違う
      expect(timeInputs('火曜日')[0].value).toBe('11:00')
      expect(timeInputs('日曜日')[0].value).toBe('11:00')
    })

    it('コピー完了を通知する', async () => {
      const { onToast } = setup({
        patterns: [pattern({ id: 'p1', day_of_week: 1, slots: [{ start: '11:00', end: '20:00' }] })],
      })
      await waitFor(() => expect(dayBlock('月曜日').getByDisplayValue('11:00')).toBeInTheDocument())

      fireEvent.click(dayBlock('月曜日').getByRole('button', { name: /全曜日にコピー/ }))
      await waitFor(() => expect(onToast).toHaveBeenCalledWith('全曜日にコピーしました', 'success'))
    })
  })
})
