import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type QueryResult, type SupabaseMock } from '../test/supabaseMock'

let mock: SupabaseMock

vi.mock('./supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import { fetchPublicStoreInfo } from './publicStoreInfo'

const STORE = { id: 'store-1', name: 'IToguchi' }

function setup(invoke: (name: string, body: unknown) => QueryResult) {
  mock = createSupabaseMock({ handler: () => ({ data: null, error: null }), invoke })
}

describe('公開店舗情報の取得', () => {
  it('booking Edge Function の get_store_public_info を呼ぶ', async () => {
    setup(() => ({ data: { store: STORE }, error: null }))
    await fetchPublicStoreInfo('store-1')

    expect(mock.invocations).toEqual([
      { name: 'booking', body: { action: 'get_store_public_info', store_id: 'store-1' } },
    ])
  })

  it('storeId を省略すると store_id なしで呼ぶ', async () => {
    setup(() => ({ data: { store: null }, error: null }))
    await fetchPublicStoreInfo()

    expect(mock.invocations[0].body).toEqual({ action: 'get_store_public_info', store_id: undefined })
  })

  it('店舗情報をそのまま返す', async () => {
    setup(() => ({ data: { store: STORE }, error: null }))
    const result = await fetchPublicStoreInfo('store-1')
    expect(result).toEqual(STORE)
  })

  it('見つからなければ null を返す', async () => {
    setup(() => ({ data: { store: null }, error: null }))
    const result = await fetchPublicStoreInfo('store-1')
    expect(result).toBeNull()
  })

  it('Edge Function のエラーを投げる', async () => {
    setup(() => ({ data: null, error: new Error('boom') }))
    await expect(fetchPublicStoreInfo('store-1')).rejects.toThrow('boom')
  })

  it('200 でもボディに error があれば投げる', async () => {
    setup(() => ({ data: { error: 'Invalid store_id format' }, error: null }))
    await expect(fetchPublicStoreInfo('bad-id')).rejects.toThrow('Invalid store_id format')
  })
})
