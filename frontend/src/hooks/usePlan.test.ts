import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createSupabaseMock, type QueryHandler, type SupabaseMock } from '../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import { usePlan } from './usePlan'

const USER_ID = 'owner-1'

function setup(plan: string | null, options: { user?: { id: string } | null; error?: unknown } = {}) {
  const { user = { id: USER_ID }, error = null } = options
  const handler: QueryHandler = (op) =>
    op.table === 'profiles' ? { data: plan === null ? null : { plan }, error } : { data: null, error: null }

  mock = createSupabaseMock({ user, handler })
  return renderHook(() => usePlan())
}

describe('usePlan', () => {
  it('pro プランを Pro と判定する', async () => {
    const { result } = setup('pro')
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isPro).toBe(true)
  })

  it('executive プランも Pro 扱いにする', async () => {
    const { result } = setup('executive')
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isPro).toBe(true)
  })

  it('free プランは Pro ではない', async () => {
    const { result } = setup('free')
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isPro).toBe(false)
  })

  it('プラン未設定は Pro ではない', async () => {
    const { result } = setup(null)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isPro).toBe(false)
  })

  it('未ログインなら Pro 判定せず読み込みを終える', async () => {
    const { result } = setup('pro', { user: null })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isPro).toBe(false)
    expect(mock.findOps('profiles')).toHaveLength(0)
  })

  it('プラン取得に失敗しても Pro に昇格させない', async () => {
    const { result } = setup(null, { error: { message: 'permission denied' } })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isPro).toBe(false)
  })

  it('自分のプロフィールだけを購読する', async () => {
    const { result } = setup('free')
    await waitFor(() => expect(result.current.loading).toBe(false))

    const sub = mock.subscriptions.find((s) => s.table === 'profiles')
    expect(sub).toBeDefined()
    expect(sub!.filter).toBe(`id=eq.${USER_ID}`)
  })

  it('Stripe決済後などにプランが変わったら即時に反映する', async () => {
    const { result } = setup('free')
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isPro).toBe(false)

    mock.emitRealtime('profiles', { new: { plan: 'pro' } })

    await waitFor(() => expect(result.current.isPro).toBe(true))
  })

  it('解約でプランが戻ったら Pro を解除する', async () => {
    const { result } = setup('pro')
    await waitFor(() => expect(result.current.isPro).toBe(true))

    mock.emitRealtime('profiles', { new: { plan: 'free' } })

    await waitFor(() => expect(result.current.isPro).toBe(false))
  })
})
