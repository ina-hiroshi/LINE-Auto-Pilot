import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createSupabaseMock, type SupabaseMock } from '../../../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import { useLineChatHistory } from './useLineChatHistory'

const log = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  store_id: 'store-1',
  line_user_id: 'U-1',
  display_name: 'たろ',
  message_content: `本文${id}`,
  created_at: `2026-08-3${id}T00:00:00Z`,
  ...over,
})

function setup(options: { rows?: unknown[]; error?: unknown; storeId?: string | null } = {}) {
  const { rows = [], error = null, storeId = 'store-1' } = options
  mock = createSupabaseMock({
    handler: (op) => (op.table === 'customer_logs' ? { data: rows, error } : { data: null, error: null }),
  })
  return renderHook(() => useLineChatHistory(storeId))
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('LINE トーク履歴の取得', () => {
  it('店舗が未確定なら問い合わせない', async () => {
    const { result } = setup({ storeId: null })
    await act(async () => {
      await result.current.fetchChatHistory('U-1')
    })
    expect(mock.findOps('customer_logs')).toHaveLength(0)
  })

  it('宛先IDが空なら問い合わせない', async () => {
    const { result } = setup()
    await act(async () => {
      await result.current.fetchChatHistory([])
    })
    expect(mock.findOps('customer_logs')).toHaveLength(0)
  })

  it('必ず店舗で絞り込む（他店舗のトークを混ぜない）', async () => {
    const { result } = setup({ rows: [log('1')] })
    await act(async () => {
      await result.current.fetchChatHistory('U-1')
    })
    const op = mock.findOps('customer_logs')[0]
    expect(mock.filterValue(op, 'store_id')).toBe('store-1')
  })

  it('複数の LINE ID をまとめて引く（ID ゆれ対策）', async () => {
    const { result } = setup({ rows: [] })
    await act(async () => {
      await result.current.fetchChatHistory(['U-1', 'U-2'])
    })
    expect(mock.filterValue(mock.findOps('customer_logs')[0], 'line_user_id')).toEqual(['U-1', 'U-2'])
  })

  it('重複した ID と空文字は落として引く', async () => {
    const { result } = setup({ rows: [] })
    await act(async () => {
      await result.current.fetchChatHistory(['U-1', 'U-1', '', 'U-2'])
    })
    expect(mock.filterValue(mock.findOps('customer_logs')[0], 'line_user_id')).toEqual(['U-1', 'U-2'])
  })

  it('新しい順に取得したものを古い順に並べ替えて返す', async () => {
    // DB からは created_at 降順で来る
    const { result } = setup({ rows: [log('3'), log('2'), log('1')] })
    await act(async () => {
      await result.current.fetchChatHistory('U-1')
    })
    expect(result.current.chatHistory.map((l) => l.id)).toEqual(['1', '2', '3'])
  })

  it('顧客が渡されたら表示名を本名に揃える', async () => {
    const { result } = setup({ rows: [log('1', { display_name: 'たろ' })] })
    await act(async () => {
      await result.current.fetchChatHistory('U-1', 50, { real_name: '山田 太郎', display_name: 'たろ' })
    })
    expect(result.current.chatHistory[0].display_name).toBe('山田 太郎')
  })

  it('本名が無ければ LINE 表示名を使う', async () => {
    const { result } = setup({ rows: [log('1')] })
    await act(async () => {
      await result.current.fetchChatHistory('U-1', 50, { real_name: null, display_name: 'たろ' })
    })
    expect(result.current.chatHistory[0].display_name).toBe('たろ')
  })

  it('顧客を渡さなければログの表示名をそのまま残す', async () => {
    const { result } = setup({ rows: [log('1', { display_name: 'ログ上の名前' })] })
    await act(async () => {
      await result.current.fetchChatHistory('U-1')
    })
    expect(result.current.chatHistory[0].display_name).toBe('ログ上の名前')
  })

  it('取得に失敗したら履歴を空にする（前の相手のトークを残さない）', async () => {
    const { result } = setup({ rows: [log('1')] })
    await act(async () => {
      await result.current.fetchChatHistory('U-1')
    })
    expect(result.current.chatHistory).toHaveLength(1)

    mock = createSupabaseMock({
      handler: () => ({ data: null, error: { message: 'permission denied' } }),
    })
    await act(async () => {
      await result.current.fetchChatHistory('U-2')
    })
    expect(result.current.chatHistory).toEqual([])
  })

  it('読み込み中フラグを立て、終わったら戻す', async () => {
    const { result } = setup({ rows: [] })
    expect(result.current.historyLoading).toBe(false)
    await act(async () => {
      await result.current.fetchChatHistory('U-1')
    })
    expect(result.current.historyLoading).toBe(false)
  })
})
