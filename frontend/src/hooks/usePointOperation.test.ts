import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createSupabaseMock, type QueryHandler, type SupabaseMock } from '../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import { usePointOperation, type MembershipCardSettings } from './usePointOperation'

const STORE_ID = 'store-1'
const LINE_USER_ID = 'U1'

const okHandler: QueryHandler = () => ({ data: null, error: null })

function setup(
  settings: MembershipCardSettings | null,
  handler: QueryHandler = okHandler,
  storeId: string | null = STORE_ID,
) {
  mock = createSupabaseMock({ handler })
  const { result } = renderHook(() => usePointOperation(storeId, settings))
  return result
}

/** points テーブルへ upsert された payload */
const upsertedPoints = () => mock.findOps('points', 'upsert')[0]?.payload as Record<string, unknown> | undefined

describe('usePointOperation', () => {
  describe('入力の検証', () => {
    it('店舗が未確定なら何も書き込まない', async () => {
      const result = setup(null, okHandler, null)
      const res = await result.current.updatePoints(LINE_USER_ID, 100, 10, 'add')

      expect(res).toEqual({ success: false, error: 'invalid' })
      expect(mock.findOps('points')).toHaveLength(0)
    })

    it('0以下の数量は受け付けない', async () => {
      const result = setup(null)
      expect(await result.current.updatePoints(LINE_USER_ID, 100, 0, 'add')).toEqual({
        success: false,
        error: 'invalid',
      })
      expect(await result.current.updatePoints(LINE_USER_ID, 100, -5, 'use')).toEqual({
        success: false,
        error: 'invalid',
      })
      expect(mock.findOps('points')).toHaveLength(0)
    })
  })

  describe('ポイントカード', () => {
    it('付与すると残高が増える', async () => {
      const result = setup({ card_type: 'point' })
      const res = await result.current.updatePoints(LINE_USER_ID, 300, 200, 'add')

      expect(res).toMatchObject({ success: true, newBalance: 500 })
      expect(upsertedPoints()).toMatchObject({
        store_id: STORE_ID,
        line_user_id: LINE_USER_ID,
        balance: 500,
      })
    })

    it('利用すると残高が減る', async () => {
      const result = setup({ card_type: 'point' })
      const res = await result.current.updatePoints(LINE_USER_ID, 300, 200, 'use')

      expect(res).toMatchObject({ success: true, newBalance: 100 })
      expect(upsertedPoints()).toMatchObject({ balance: 100 })
    })

    it('残高ちょうどの利用は許可する', async () => {
      const result = setup({ card_type: 'point' })
      const res = await result.current.updatePoints(LINE_USER_ID, 300, 300, 'use')

      expect(res).toMatchObject({ success: true, newBalance: 0 })
    })

    it('残高を超える利用は0に丸めず、明示的に断る', async () => {
      // 0 にクランプすると「500pt利用しました」と表示しながら
      // 実際は300ptしか引かれていない、という食い違いが起きる。
      const result = setup({ card_type: 'point' })
      const res = await result.current.updatePoints(LINE_USER_ID, 300, 500, 'use')

      expect(res).toEqual({ success: false, error: 'insufficient' })
      expect(mock.findOps('points')).toHaveLength(0)
    })

    it('ポイントカードでは満了フラグを立てない', async () => {
      const result = setup({ card_type: 'point' })
      const res = await result.current.updatePoints(LINE_USER_ID, 0, 20, 'add')

      expect(res).toMatchObject({ success: true, newBalance: 20, stampCompleted: false })
      expect(mock.findOps('customer_logs')).toHaveLength(0)
    })
  })

  describe('スタンプカード', () => {
    const stamp = (total_slots: number, goal_reward = 'ドリンク1杯無料'): MembershipCardSettings => ({
      card_type: 'stamp',
      stamp_config: { total_slots, goal_reward },
    })

    it('満了に届かなければ押印されるだけ', async () => {
      const result = setup(stamp(10))
      const res = await result.current.updatePoints(LINE_USER_ID, 3, 2, 'add')

      expect(res).toMatchObject({ success: true, newBalance: 5, stampCompleted: false })
      expect(mock.findOps('customer_logs')).toHaveLength(0)
    })

    it('ちょうど満了したらリセットして満了を通知する', async () => {
      const result = setup(stamp(10))
      const res = await result.current.updatePoints(LINE_USER_ID, 9, 1, 'add')

      expect(res).toMatchObject({ success: true, newBalance: 0, stampCompleted: true })
    })

    it('満了を超えた場合も余りを繰り越しつつ満了を通知する', async () => {
      // 満了ちょうど（余り0）でなければ通知しない実装だと、
      // 15個目+10個押印のようなケースで達成が握り潰される。
      const result = setup(stamp(20))
      const res = await result.current.updatePoints(LINE_USER_ID, 15, 10, 'add')

      expect(res).toMatchObject({ success: true, newBalance: 5, stampCompleted: true })
    })

    it('total_slots 未設定なら20枠として扱う', async () => {
      const result = setup({ card_type: 'stamp', stamp_config: {} })
      const res = await result.current.updatePoints(LINE_USER_ID, 19, 1, 'add')

      expect(res).toMatchObject({ success: true, newBalance: 0, stampCompleted: true })
    })

    it('customer_logs には書き込まない（トーク履歴用テーブルで満了ログは持てない）', async () => {
      // customer_logs は message_content NOT NULL の LINE トーク履歴テーブルで、
      // action_type / details 列を持たない。ここへの INSERT は常に失敗するため、
      // 満了は stampCompleted の戻り値だけで伝える。
      const result = setup(stamp(10))
      const res = await result.current.updatePoints(LINE_USER_ID, 9, 1, 'add')

      expect(res).toMatchObject({ stampCompleted: true })
      expect(mock.findOps('customer_logs')).toHaveLength(0)
    })

    it('利用（マイナス）ではスタンプの繰り越し処理をしない', async () => {
      const result = setup(stamp(10))
      const res = await result.current.updatePoints(LINE_USER_ID, 8, 3, 'use')

      expect(res).toMatchObject({ success: true, newBalance: 5, stampCompleted: false })
      expect(mock.findOps('customer_logs')).toHaveLength(0)
    })
  })

  describe('書き込み経路', () => {
    it('points は store_id + line_user_id の複合キーで upsert する', async () => {
      const result = setup({ card_type: 'point' })
      await result.current.updatePoints(LINE_USER_ID, 0, 10, 'add')

      const op = mock.findOps('points', 'upsert')[0]
      expect(op).toBeDefined()
      expect(op.payload).toMatchObject({ store_id: STORE_ID, line_user_id: LINE_USER_ID })
    })

    it('残高更新をリアルタイム通知でブロードキャストする', async () => {
      const result = setup({ card_type: 'point' })
      await result.current.updatePoints(LINE_USER_ID, 0, 10, 'add')

      expect(mock.broadcasts).toHaveLength(1)
      expect(mock.broadcasts[0].topic).toBe(`points:${STORE_ID}`)
      expect(mock.broadcasts[0].payload).toMatchObject({
        type: 'broadcast',
        event: 'update',
        payload: { line_user_id: LINE_USER_ID },
      })
    })

    it('リアルタイム通知が失敗しても、保存済みの残高更新は成功として扱う', async () => {
      // 通知は付随処理。ここで失敗扱いにすると、DBは更新済みなのに
      // 画面には「更新に失敗しました」と出て実態と食い違う。
      mock = createSupabaseMock({ handler: okHandler, broadcastFails: true })
      const { result } = renderHook(() => usePointOperation(STORE_ID, { card_type: 'point' }))

      const res = await result.current.updatePoints(LINE_USER_ID, 0, 10, 'add')
      expect(res).toMatchObject({ success: true, newBalance: 10 })
    })

    it('upsert が失敗したら失敗を返す', async () => {
      const result = setup({ card_type: 'point' }, (op) =>
        op.table === 'points' ? { data: null, error: { message: 'permission denied' } } : { data: null, error: null },
      )
      const res = await result.current.updatePoints(LINE_USER_ID, 0, 10, 'add')

      expect(res).toEqual({ success: false, error: 'failed' })
    })
  })
})
