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

const prepareImageForLine = vi.fn()
vi.mock('../lib/lineImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/lineImage')>()
  return { ...actual, prepareImageForLine: (file: File) => prepareImageForLine(file) }
})

import { useLineReply } from './useLineReply'
import { LineImageError } from '../lib/lineImage'

const PARAMS = { storeId: 'store-1', userId: 'U-1', text: 'ありがとうございます' }

function setup(options: {
  invoke?: (name: string, body: unknown) => QueryResult
  user?: { id: string } | null
  updateError?: unknown
  uploadError?: unknown
} = {}) {
  const { invoke, user, updateError = null, uploadError = null } = options
  mock = createSupabaseMock({
    user: user === undefined ? { id: 'owner-1' } : user,
    handler: (op) => (op.table === 'customer_logs' ? { data: null, error: updateError } : { data: null, error: null }),
    invoke,
    uploadError,
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

describe('画像の送信', () => {
  const photo = new File(['x'], 'photo.png', { type: 'image/png' })
  const ok = () => ({ data: { success: true, lineUserId: 'U-1' }, error: null })

  beforeEach(() => {
    prepareImageForLine.mockReset()
    prepareImageForLine.mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
  })

  it('画像を店舗のフォルダにアップロードし、公開 URL を Edge Function に渡す', async () => {
    const { result } = setup({ invoke: ok })

    await act(async () => {
      await result.current.sendMessage({ ...PARAMS, text: '', imageFile: photo })
    })

    expect(mock.uploads).toHaveLength(1)
    expect(mock.uploads[0].bucket).toBe('line-sent-images')
    expect(mock.uploads[0].path).toMatch(/^store-1\/[0-9a-f-]+\.jpg$/)
    const body = mock.invocations[0].body as Record<string, unknown>
    expect(body.imageUrl).toBe(
      `https://example.supabase.co/storage/v1/object/public/line-sent-images/${mock.uploads[0].path}`,
    )
    expect(body).not.toHaveProperty('imageFile')
  })

  it('文も画像もなければ送らない', async () => {
    const { result } = setup({ invoke: ok })

    let outcome: Awaited<ReturnType<typeof result.current.sendMessage>> | undefined
    await act(async () => {
      outcome = await result.current.sendMessage({ ...PARAMS, text: '  ' })
    })

    expect(outcome?.success).toBe(false)
    expect(mock.invocations).toHaveLength(0)
  })

  it('読み込めない画像は理由を返し、送信しない', async () => {
    prepareImageForLine.mockRejectedValue(new LineImageError('この画像は読み込めませんでした'))
    const { result } = setup({ invoke: ok })

    let outcome: Awaited<ReturnType<typeof result.current.sendMessage>> | undefined
    await act(async () => {
      outcome = await result.current.sendMessage({ ...PARAMS, imageFile: photo })
    })

    expect(outcome).toEqual({ success: false, message: 'この画像は読み込めませんでした' })
    expect(mock.invocations).toHaveLength(0)
  })

  it('アップロードに失敗したら送信しない', async () => {
    const { result } = setup({ invoke: ok, uploadError: { message: 'denied' } })

    let outcome: Awaited<ReturnType<typeof result.current.sendMessage>> | undefined
    await act(async () => {
      outcome = await result.current.sendMessage({ ...PARAMS, imageFile: photo })
    })

    expect(outcome).toEqual({ success: false, message: '画像のアップロードに失敗しました' })
    expect(mock.invocations).toHaveLength(0)
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
