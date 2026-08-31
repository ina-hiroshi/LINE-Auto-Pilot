import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type QueryHandler, type SupabaseMock } from '../../../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import { resolveMessagingLineUserId, resolveMessagingLineUserIds } from './resolveMessagingLineUserId'

const STORE = 'store-1'

/** display_name → customer_logs の line_user_id 一覧 */
function setup(logsByName: Record<string, string[]>, directLogs: string[] = []) {
  const handler: QueryHandler = (op) => {
    if (op.table !== 'customer_logs') return { data: null, error: null }
    const nameFilter = mock.filterValue(op, 'display_name') as string | undefined
    if (nameFilter !== undefined) {
      return { data: (logsByName[nameFilter] ?? []).map((id) => ({ line_user_id: id })), error: null }
    }
    return { data: directLogs.map((id) => ({ line_user_id: id })), error: null }
  }
  mock = createSupabaseMock({ handler })
}

beforeEach(() => {
  setup({})
})

describe('メッセージ送信先の LINE ユーザーID 解決', () => {
  describe('候補の収集', () => {
    it('ログが無ければ顧客の line_user_id だけを返す', async () => {
      setup({})
      const ids = await resolveMessagingLineUserIds(STORE, {
        line_user_id: 'U-liff',
        display_name: null,
      })
      expect(ids).toEqual(['U-liff'])
    })

    it('本名と表示名の両方でログを照会する', async () => {
      setup({ '山田 太郎': ['U-msg'], 'たろ': ['U-msg2'] })
      const ids = await resolveMessagingLineUserIds(STORE, {
        line_user_id: 'U-liff',
        display_name: 'たろ',
        real_name: '山田 太郎',
      })
      expect(ids.sort()).toEqual(['U-liff', 'U-msg', 'U-msg2'].sort())
    })

    it('本名と表示名が同じなら照会は1回にまとめる', async () => {
      setup({ 'たろ': ['U-msg'] })
      await resolveMessagingLineUserIds(STORE, {
        line_user_id: 'U-liff',
        display_name: 'たろ',
        real_name: 'たろ',
      })
      const nameQueries = mock
        .findOps('customer_logs', 'select')
        .filter((op) => mock.filterValue(op, 'display_name') !== undefined)
      expect(nameQueries).toHaveLength(1)
    })

    it('空白だけの名前では照会しない', async () => {
      setup({})
      await resolveMessagingLineUserIds(STORE, {
        line_user_id: 'U-liff',
        display_name: '   ',
        real_name: '',
      })
      const nameQueries = mock
        .findOps('customer_logs', 'select')
        .filter((op) => mock.filterValue(op, 'display_name') !== undefined)
      expect(nameQueries).toHaveLength(0)
    })

    it('必ず店舗で絞り込む（他店舗のログを拾わない）', async () => {
      setup({ 'たろ': ['U-msg'] })
      await resolveMessagingLineUserIds(STORE, { line_user_id: 'U-liff', display_name: 'たろ' })
      for (const op of mock.findOps('customer_logs', 'select')) {
        expect(mock.filterValue(op, 'store_id')).toBe(STORE)
      }
    })

    it('名前で見つからなかったときだけ ID 直結のログを見に行く', async () => {
      setup({}, ['U-liff'])
      await resolveMessagingLineUserIds(STORE, { line_user_id: 'U-liff', display_name: 'たろ' })
      const directQueries = mock
        .findOps('customer_logs', 'select')
        .filter((op) => mock.filterValue(op, 'line_user_id') !== undefined)
      expect(directQueries).toHaveLength(1)
    })

    it('名前で見つかったら ID 直結の照会はしない', async () => {
      setup({ 'たろ': ['U-msg'] })
      await resolveMessagingLineUserIds(STORE, { line_user_id: 'U-liff', display_name: 'たろ' })
      const directQueries = mock
        .findOps('customer_logs', 'select')
        .filter((op) => mock.filterValue(op, 'line_user_id') !== undefined)
      expect(directQueries).toHaveLength(0)
    })

    it('同じIDが複数ログに出ても重複させない', async () => {
      setup({ 'たろ': ['U-msg', 'U-msg', 'U-liff'] })
      const ids = await resolveMessagingLineUserIds(STORE, {
        line_user_id: 'U-liff',
        display_name: 'たろ',
      })
      expect(ids).toHaveLength(2)
    })

    it('line_user_id が空のログ行は無視する', async () => {
      mock = createSupabaseMock({
        handler: (op) =>
          op.table === 'customer_logs'
            ? { data: [{ line_user_id: null }, { line_user_id: '' }], error: null }
            : { data: null, error: null },
      })
      const ids = await resolveMessagingLineUserIds(STORE, {
        line_user_id: 'U-liff',
        display_name: 'たろ',
      })
      expect(ids).toEqual(['U-liff'])
    })
  })

  describe('送信先の決定', () => {
    it('候補が1つならそれを使う', async () => {
      setup({})
      const id = await resolveMessagingLineUserId(STORE, {
        line_user_id: 'U-liff',
        display_name: null,
      })
      expect(id).toBe('U-liff')
    })

    it('LIFF側と Messaging 側でIDが違うなら Messaging 側を優先する', async () => {
      setup({ 'たろ': ['U-msg'] })
      const id = await resolveMessagingLineUserId(STORE, {
        line_user_id: 'U-liff',
        display_name: 'たろ',
      })
      expect(id).toBe('U-msg')
    })

    it('ログのIDが顧客と同一なら顧客のIDのまま', async () => {
      setup({ 'たろ': ['U-liff'] })
      const id = await resolveMessagingLineUserId(STORE, {
        line_user_id: 'U-liff',
        display_name: 'たろ',
      })
      expect(id).toBe('U-liff')
    })
  })
})
