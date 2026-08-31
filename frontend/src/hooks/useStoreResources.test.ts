import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createSupabaseMock, type QueryHandler, type SupabaseMock } from '../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import { useStoreResources } from './useStoreResources'

const STORE_ID = 'store-1'

const staff = [
  { id: 's1', name: '田中', role: 'スタイリスト', image_url: null, is_active: true },
  { id: 's2', name: '佐藤', role: null, image_url: null, is_active: true },
]
const menus = [
  {
    id: 'm1',
    name: 'カット',
    description: null,
    price: 4000,
    duration_minutes: 60,
    capacity_per_slot: 1,
    is_active: true,
  },
]

function setup(
  options: { storeId?: string | null; staffData?: unknown; menuData?: unknown; error?: unknown } = {},
) {
  const { storeId = STORE_ID, staffData = staff, menuData = menus, error = null } = options

  const handler: QueryHandler = (op) => {
    if (op.table === 'staff_members') return { data: staffData, error }
    if (op.table === 'booking_menus') return { data: menuData, error }
    return { data: null, error: null }
  }

  mock = createSupabaseMock({ handler })
  return renderHook(() => useStoreResources(storeId))
}

describe('useStoreResources', () => {
  it('自店舗の有効なスタッフとメニューを取得する', async () => {
    const { result } = setup()

    await waitFor(() => expect(result.current.staffList).toHaveLength(2))
    expect(result.current.menuList).toHaveLength(1)
    expect(result.current.staffList[0].name).toBe('田中')
    expect(result.current.menuList[0].name).toBe('カット')
  })

  it('store_id と is_active で絞り込む', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.staffList).toHaveLength(2))

    for (const table of ['staff_members', 'booking_menus']) {
      const op = mock.findOps(table, 'select')[0]
      expect(op, `${table} を取得していない`).toBeDefined()
      expect(op.filters).toContainEqual({ op: 'eq', column: 'store_id', value: STORE_ID })
      expect(op.filters).toContainEqual({ op: 'eq', column: 'is_active', value: true })
    }
  })

  it('店舗が未確定なら問い合わせない', async () => {
    const { result } = setup({ storeId: null })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mock.findOps('staff_members')).toHaveLength(0)
    expect(mock.findOps('booking_menus')).toHaveLength(0)
    expect(result.current.staffList).toEqual([])
  })

  it('取得に失敗しても例外を投げず空のまま保つ', async () => {
    const { result } = setup({ staffData: null, menuData: null, error: { message: 'permission denied' } })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.staffList).toEqual([])
    expect(result.current.menuList).toEqual([])
  })

  it('データが null なら直前の一覧を消さない', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.staffList).toHaveLength(2))

    // スタッフ追加後の再取得で一時的に null が返っても表示を壊さない
    await act(async () => {
      await result.current.refreshResources()
    })
    expect(result.current.staffList).toHaveLength(2)
  })

  it('refreshResources で再取得できる', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.staffList).toHaveLength(2))
    const before = mock.findOps('staff_members', 'select').length

    await act(async () => {
      await result.current.refreshResources()
    })

    expect(mock.findOps('staff_members', 'select').length).toBe(before + 1)
  })

  it('setStaffList / setMenuList で楽観的に差し替えられる', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.staffList).toHaveLength(2))

    act(() => {
      result.current.setStaffList([
        { id: 's9', name: '新人', role: null, image_url: null, is_active: true },
      ])
    })

    expect(result.current.staffList).toHaveLength(1)
    expect(result.current.staffList[0].name).toBe('新人')
  })
})
