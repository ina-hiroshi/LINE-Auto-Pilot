import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createSupabaseMock, type SupabaseMock } from '../../../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import { useManualReplyCount } from './useManualReplyCount'

function setup(storeId: string | null, counts: number[]) {
  let call = 0
  mock = createSupabaseMock({
    handler: (op) =>
      op.table === 'customer_logs' ? { data: null, error: null, count: counts[Math.min(call++, counts.length - 1)] } : undefined,
  })
  return renderHook(() => useManualReplyCount(storeId))
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('要対応の件数', () => {
  it('自店舗の要対応だけを数える', async () => {
    const { result } = setup('store-1', [3])
    await waitFor(() => expect(result.current).toBe(3))
    const op = mock.findOps('customer_logs')[0]
    expect(mock.filterValue(op, 'store_id')).toBe('store-1')
    expect(mock.filterValue(op, 'status')).toBe('manual_reply_needed')
  })

  it('受信や対応があれば数え直す', async () => {
    const { result } = setup('store-1', [1, 2])
    await waitFor(() => expect(result.current).toBe(1))
    await act(async () => {
      mock.emitRealtime('customer_logs', { eventType: 'INSERT' })
    })
    await waitFor(() => expect(result.current).toBe(2))
  })

  it('店舗が未確定なら数えない', async () => {
    const { result } = setup(null, [5])
    expect(result.current).toBe(0)
    expect(mock.findOps('customer_logs')).toHaveLength(0)
  })
})
