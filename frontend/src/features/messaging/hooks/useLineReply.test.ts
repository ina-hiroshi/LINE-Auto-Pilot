import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { createSupabaseMock, type QueryResult, type SupabaseMock } from '../../../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import { useLineReply } from './useLineReply'

const PARAMS = { storeId: 'store-1', userId: 'U-1', text: 'ありがとうございます' }

function setup(options: {
  invoke?: (name: string, body: unknown) => QueryResult
  user?: { id: string } | null
  updateError?: unknown
} = {}) {
  const { invoke, user, updateError = null } = options
  mock = createSupabaseMock({
    user: user === undefined ? { id: 'owner-1' } : user,
    handler: (op) => (op.table === 'customer_logs' ? { data: null, error: updateError } : { data: null, error: null }),
    invoke,
  })
  return renderHook(() => useLineReply())
}

/** Edge Function が JSON ボディ付きで失敗した状況を作る */
const httpError = (body: unknown) =>
  new FunctionsHttpError({
    json: async () => body,
  } as unknown as Response)

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('LINE 返信の送信', () => {
  it('送信内容をそのまま Edge Function に渡す', async () => {
    const { result } = setup({ invoke: () => ({ data: { success: true, lineUserId: 'U-1' }, error: null }) })

    await act(async () => {
      await result.current.sendMessage({ ...PARAMS, replyToLogId: 'log-1', customerId: 'cus-1' })
    })

    expect(mock.invocations).toHaveLength(1)
    expect(mock.invocations[0].name).toBe('send-line-message')
    expect(mock.invocations[0].body).toMatchObject({
      storeId: 'store-1',
      userId: 'U-1',
      text: 'ありがとうございます',
      replyToLogId: 'log-1',
      customerId: 'cus-1',
    })
  })

  it('実際に届いた宛先 ID を返す（画面の宛先と違うことがある）', async () => {
    const { result } = setup({ invoke: () => ({ data: { success: true, lineUserId: 'U-messaging' }, error: null }) })

    let outcome: Awaited<ReturnType<typeof result.current.sendMessage>> | undefined
    await act(async () => {
      outcome = await result.current.sendMessage(PARAMS)
    })

    expect(outcome).toEqual({ success: true, lineUserId: 'U-messaging' })
  })

  it('未ログインなら送信しない', async () => {
    const { result } = setup({ user: null })

    let outcome: Awaited<ReturnType<typeof result.current.sendMessage>> | undefined
    await act(async () => {
      outcome = await result.current.sendMessage(PARAMS)
    })

    expect(outcome).toEqual({ success: false, message: '認証エラー' })
    expect(mock.invocations).toHaveLength(0)
  })

  it('Edge Function のエラーメッセージをそのまま画面に出せるよう返す', async () => {
    const { result } = setup({
      invoke: () => ({
        data: null,
        error: httpError({ error: 'LINE公式アカウントが連携されていません。' }),
      }),
    })

    let outcome: Awaited<ReturnType<typeof result.current.sendMessage>> | undefined
    await act(async () => {
      outcome = await result.current.sendMessage(PARAMS)
    })

    expect(outcome).toEqual({
      success: false,
      message: 'LINE公式アカウントが連携されていません。',
    })
  })

  it('エラー本文が読めなければ既定の文言にする', async () => {
    const { result } = setup({
      invoke: () => ({
        data: null,
        error: new FunctionsHttpError({
          json: async () => {
            throw new Error('not json')
          },
        } as unknown as Response),
      }),
    })

    let outcome: Awaited<ReturnType<typeof result.current.sendMessage>> | undefined
    await act(async () => {
      outcome = await result.current.sendMessage(PARAMS)
    })

    expect(outcome).toEqual({ success: false, message: '送信に失敗しました' })
  })

  it('200 でもボディに error があれば失敗として扱う', async () => {
    const { result } = setup({ invoke: () => ({ data: { error: '友だち追加されていません' }, error: null }) })

    let outcome: Awaited<ReturnType<typeof result.current.sendMessage>> | undefined
    await act(async () => {
      outcome = await result.current.sendMessage(PARAMS)
    })

    expect(outcome).toEqual({ success: false, message: '友だち追加されていません' })
  })

  it('送信中フラグを立て、終わったら必ず戻す', async () => {
    const { result } = setup({ invoke: () => ({ data: null, error: httpError({ error: 'ng' }) }) })

    expect(result.current.sending).toBe(false)
    await act(async () => {
      await result.current.sendMessage(PARAMS)
    })
    await waitFor(() => expect(result.current.sending).toBe(false))
  })
})

describe('対応済みへの変更', () => {
  it('指定したログを resolved にする', async () => {
    const { result } = setup()

    let outcome: Awaited<ReturnType<typeof result.current.resolveLog>> | undefined
    await act(async () => {
      outcome = await result.current.resolveLog('log-1')
    })

    expect(outcome).toEqual({ success: true })
    const op = mock.findOps('customer_logs', 'update')[0]
    expect(op.payload).toEqual({ status: 'resolved' })
    expect(mock.filterValue(op, 'id')).toBe('log-1')
  })

  it('失敗したら成功として扱わない', async () => {
    const { result } = setup({ updateError: { message: 'permission denied' } })

    let outcome: Awaited<ReturnType<typeof result.current.resolveLog>> | undefined
    await act(async () => {
      outcome = await result.current.resolveLog('log-1')
    })

    expect(outcome).toEqual({ success: false })
  })
})
