import { describe, expect, it, vi } from 'vitest'

// resolveCustomer は supabase クライアントを import するため、env 依存を切り離す
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))

import {
  augmentLineUserIdMapFromLogs,
  buildCustomerLookupMaps,
  resolveCustomerIdFromLog,
  type CustomerLookupRow,
} from './resolveCustomer'
import { enrichLogsWithCustomerLabels, formatCustomerLabel } from './customerDisplayName'
import type { LogEntry } from '../../messaging/types'

const customer = (over: Partial<CustomerLookupRow> & { id: string; line_user_id: string }): CustomerLookupRow => ({
  display_name: null,
  real_name: null,
  ...over,
})

const log = (over: Partial<LogEntry> & { line_user_id: string }): LogEntry => ({
  id: `log-${over.line_user_id}`,
  created_at: '2026-08-31T00:00:00Z',
  message_content: 'こんにちは',
  reply_content: null,
  status: 'manual_reply_needed',
  ...over,
})

describe('formatCustomerLabel', () => {
  it('本名を最優先で返す', () => {
    expect(formatCustomerLabel({ real_name: '山田 太郎', display_name: 'たろ' })).toBe('山田 太郎')
  })

  it('本名が空白のみならLINE表示名にフォールバックする', () => {
    expect(formatCustomerLabel({ real_name: '   ', display_name: 'たろ' })).toBe('たろ')
  })

  it('どちらも無ければ既定のフォールバック文字列を返す', () => {
    expect(formatCustomerLabel({ real_name: null, display_name: null })).toBe('ゲスト')
    expect(formatCustomerLabel(null)).toBe('ゲスト')
    expect(formatCustomerLabel(undefined, '未登録')).toBe('未登録')
  })
})

describe('buildCustomerLookupMaps', () => {
  it('line_user_id / LINE表示名 / 本名 の3系統で索引を作る', () => {
    const maps = buildCustomerLookupMaps([
      customer({ id: 'c1', line_user_id: 'U1', display_name: 'たろ', real_name: '山田 太郎' }),
    ])

    expect(maps.byLineUserId).toEqual({ U1: 'c1' })
    expect(maps.byDisplayName).toEqual({ たろ: 'c1' })
    expect(maps.byRealName).toEqual({ '山田 太郎': 'c1' })
  })

  it('空白のみの表示名は索引に載せない（全員が同じキーに衝突するのを防ぐ）', () => {
    const maps = buildCustomerLookupMaps([
      customer({ id: 'c1', line_user_id: 'U1', display_name: '   ', real_name: '  ' }),
      customer({ id: 'c2', line_user_id: 'U2', display_name: '', real_name: null }),
    ])

    expect(maps.byDisplayName).toEqual({})
    expect(maps.byRealName).toEqual({})
  })
})

describe('resolveCustomerIdFromLog', () => {
  const rows = [
    customer({ id: 'c1', line_user_id: 'U1', display_name: 'たろ', real_name: '山田 太郎' }),
    customer({ id: 'c2', line_user_id: 'U2', display_name: 'はな', real_name: '鈴木 花子' }),
  ]

  it('line_user_id が一致する顧客を返す', () => {
    const { byLineUserId, byDisplayName, byRealName } = buildCustomerLookupMaps(rows)
    expect(resolveCustomerIdFromLog(log({ line_user_id: 'U2' }), byLineUserId, byDisplayName, byRealName)).toBe('c2')
  })

  it('line_user_id 未知でも表示名が一致すれば解決できる', () => {
    const { byLineUserId, byDisplayName, byRealName } = buildCustomerLookupMaps(rows)
    const result = resolveCustomerIdFromLog(
      log({ line_user_id: 'U-unknown', display_name: '鈴木 花子' }),
      byLineUserId,
      byDisplayName,
      byRealName,
    )
    expect(result).toBe('c2')
  })

  it('手掛かりが無ければ null を返す', () => {
    const { byLineUserId, byDisplayName, byRealName } = buildCustomerLookupMaps(rows)
    expect(
      resolveCustomerIdFromLog(log({ line_user_id: 'U-unknown' }), byLineUserId, byDisplayName, byRealName),
    ).toBeNull()
  })

  it('同名の顧客が複数いる表示名では解決しない（別人のログの取り違え防止）', () => {
    // LINE の表示名は一意ではない。同じ表示名の顧客が2人いる状況は普通に起こりうる。
    const duplicated = [
      customer({ id: 'c1', line_user_id: 'U1', display_name: 'ゆき', real_name: '佐藤 ゆき' }),
      customer({ id: 'c2', line_user_id: 'U2', display_name: 'ゆき', real_name: '高橋 ゆき' }),
    ]
    const { byLineUserId, byDisplayName, byRealName } = buildCustomerLookupMaps(duplicated)

    // まだ customers に登録されていない3人目の「ゆき」からのログ
    const unknownYuki = log({ line_user_id: 'U3', display_name: 'ゆき' })

    const resolved = resolveCustomerIdFromLog(unknownYuki, byLineUserId, byDisplayName, byRealName)

    // 一意に定まらないので解決しない。後勝ちで c2 に割り当てると
    // 無関係の顧客のトーク履歴に混ざってしまう。
    expect(resolved).toBeNull()
  })
})

describe('augmentLineUserIdMapFromLogs', () => {
  const rows = [
    customer({ id: 'c1', line_user_id: 'U1', display_name: 'たろ', real_name: '山田 太郎' }),
  ]

  it('既知の line_user_id は上書きしない', () => {
    const { byLineUserId, byDisplayName, byRealName } = buildCustomerLookupMaps(rows)
    const map = augmentLineUserIdMapFromLogs(
      [log({ line_user_id: 'U1', display_name: '別名' })],
      byLineUserId,
      byDisplayName,
      byRealName,
    )
    expect(map.U1).toBe('c1')
  })

  it('曖昧な表示名一致を line_user_id マップにキャッシュしない', () => {
    const duplicated = [
      customer({ id: 'c1', line_user_id: 'U1', display_name: 'ゆき', real_name: '佐藤 ゆき' }),
      customer({ id: 'c2', line_user_id: 'U2', display_name: 'ゆき', real_name: '高橋 ゆき' }),
    ]
    const { byLineUserId, byDisplayName, byRealName } = buildCustomerLookupMaps(duplicated)

    const map = augmentLineUserIdMapFromLogs(
      [log({ line_user_id: 'U3', display_name: 'ゆき' })],
      byLineUserId,
      byDisplayName,
      byRealName,
    )

    // 曖昧な一致はキャッシュせず、未解決のままにする
    expect(map.U3).toBeUndefined()
  })
})

describe('enrichLogsWithCustomerLabels', () => {
  it('ログの表示名を顧客マスタの本名に揃える', () => {
    const rows = [customer({ id: 'c1', line_user_id: 'U1', display_name: 'たろ', real_name: '山田 太郎' })]
    const { byLineUserId, byDisplayName, byRealName } = buildCustomerLookupMaps(rows)

    const [enriched] = enrichLogsWithCustomerLabels(
      [log({ line_user_id: 'U1', display_name: 'たろ' })],
      rows,
      byLineUserId,
      byDisplayName,
      byRealName,
    )

    expect(enriched.display_name).toBe('山田 太郎')
  })

  it('顧客未登録のログは元の表示名を保つ', () => {
    const [enriched] = enrichLogsWithCustomerLabels(
      [log({ line_user_id: 'U9', display_name: '通りすがり' })],
      [],
      {},
      {},
      {},
    )
    expect(enriched.display_name).toBe('通りすがり')
  })
})
