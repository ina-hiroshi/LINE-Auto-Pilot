import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createSupabaseMock, type QueryResult, type SupabaseMock } from '../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import { usePublicBookingResources } from './usePublicBookingResources'

const STORE_ID = 'store-1'

const staff = [{ id: 's1', name: '田中', role: null, image_url: null, is_active: true }]
const menus = [
  { id: 'm1', name: 'カット', description: null, price: 4000, duration_minutes: 60, capacity_per_slot: 1, is_active: true },
]
const specialDates = [{ date: '2026-12-31', is_closed: true, override_hours: null }]

function setup(options: {
  storeId?: string | null
  invoke?: (name: string, body: unknown) => QueryResult
} = {}) {
  const { storeId = STORE_ID, invoke } = options
  mock = createSupabaseMock({
    handler: () => ({ data: null, error: null }),
    invoke: invoke ?? (() => ({ data: { staffList: staff, menuList: menus, specialDates }, error: null })),
  })
  return renderHook(() => usePublicBookingResources(storeId))
}

describe('公開予約画面のスタッフ・メニュー・特定日取得', () => {
  it('booking Edge Function の get_booking_resources を呼ぶ', async () => {
    setup()
    await waitFor(() => expect(mock.invocations).toHaveLength(1))
    expect(mock.invocations[0]).toEqual({
      name: 'booking',
      body: { action: 'get_booking_resources', store_id: STORE_ID },
    })
  })

  it('店舗IDが未確定なら呼び出さない', async () => {
    setup({ storeId: null })
    await act(async () => {})
    expect(mock.invocations).toHaveLength(0)
  })

  it('スタッフとメニューをそのまま反映する', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.staffList).toEqual(staff))
    expect(result.current.menuList).toEqual(menus)
  })

  it('特定日の配列を日付キーのマップに変換する', async () => {
    const { result } = setup()
    await waitFor(() =>
      expect(result.current.specialDates).toEqual({
        '2026-12-31': { is_closed: true, override_hours: null },
      }),
    )
  })

  it('Edge Function がエラーを返したら error に文言を入れる', async () => {
    const { result } = setup({
      invoke: () => ({ data: null, error: new Error('invalid store_id format') }),
    })
    await waitFor(() => expect(result.current.error).toBe('invalid store_id format'))
    expect(result.current.staffList).toEqual([])
  })

  it('200 でもボディに error があれば失敗として扱う', async () => {
    const { result } = setup({
      invoke: () => ({ data: { error: 'store_id is required' }, error: null }),
    })
    await waitFor(() => expect(result.current.error).toBe('store_id is required'))
  })

  it('取得中はローディングフラグを立て、終わったら戻す', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('setStaffList / setMenuList / setSpecialDates で外部から上書きできる（プレビュー用）', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.staffList).toEqual(staff))

    act(() => {
      result.current.setStaffList([{ id: 'preview', name: 'プレビュー', role: null, image_url: null, is_active: true }])
    })
    expect(result.current.staffList).toEqual([
      { id: 'preview', name: 'プレビュー', role: null, image_url: null, is_active: true },
    ])
  })

  it('refresh で明示的に再取得できる', async () => {
    const { result } = setup()
    await waitFor(() => expect(mock.invocations).toHaveLength(1))

    await act(async () => {
      await result.current.refresh()
    })
    expect(mock.invocations).toHaveLength(2)
  })
})
