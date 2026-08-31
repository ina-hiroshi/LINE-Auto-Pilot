import { describe, expect, it } from 'vitest'
import { enrichLogsWithCustomerLabels, formatCustomerLabel } from './customerDisplayName'
import { buildCustomerLookupMaps, type CustomerLookupRow } from './resolveCustomer'
import type { LogEntry } from '../../messaging/types'

const customer = (over: Partial<CustomerLookupRow> & { id: string }): CustomerLookupRow => ({
  line_user_id: `U-${over.id}`,
  display_name: null,
  real_name: null,
  ...over,
})

const log = (
  over: Omit<Partial<LogEntry>, 'display_name'> & { id: string; display_name?: string | null },
): LogEntry =>
  ({
    store_id: 'store-1',
    line_user_id: 'U-1',
    display_name: null,
    message_content: '本文',
    created_at: '2026-08-31T00:00:00Z',
    ...over,
  }) as unknown as LogEntry

describe('顧客名の表示', () => {
  it('本名を最優先する', () => {
    expect(formatCustomerLabel({ real_name: '山田 太郎', display_name: 'たろ' })).toBe('山田 太郎')
  })

  it('本名が無ければ LINE 表示名', () => {
    expect(formatCustomerLabel({ real_name: null, display_name: 'たろ' })).toBe('たろ')
  })

  it('空白だけの名前は無視する', () => {
    expect(formatCustomerLabel({ real_name: '   ', display_name: '  ' })).toBe('ゲスト')
  })

  it('顧客が無ければ既定の呼び名', () => {
    expect(formatCustomerLabel(null)).toBe('ゲスト')
    expect(formatCustomerLabel(undefined)).toBe('ゲスト')
  })

  it('既定の呼び名は差し替えられる', () => {
    expect(formatCustomerLabel(null, 'ログ上の名前')).toBe('ログ上の名前')
  })
})

describe('トークログの表示名を顧客マスタに揃える', () => {
  const customers = [
    customer({ id: 'c1', line_user_id: 'U-1', display_name: 'たろ', real_name: '山田 太郎' }),
    customer({ id: 'c2', line_user_id: 'U-2', display_name: 'はな', real_name: '鈴木 花子' }),
  ]
  const maps = buildCustomerLookupMaps(customers)

  const enrich = (logs: LogEntry[]) =>
    enrichLogsWithCustomerLabels(logs, customers, maps.byLineUserId, maps.byDisplayName, maps.byRealName)

  it('LINE ID が一致すれば本名に置き換える', () => {
    const [row] = enrich([log({ id: 'l1', line_user_id: 'U-1', display_name: 'たろ' })])
    expect(row.display_name).toBe('山田 太郎')
  })

  it('LINE ID が違っても表示名が一致すれば紐づける', () => {
    const [row] = enrich([log({ id: 'l1', line_user_id: 'U-unknown', display_name: 'はな' })])
    expect(row.display_name).toBe('鈴木 花子')
  })

  it('照合できなければログの表示名を残す', () => {
    const [row] = enrich([log({ id: 'l1', line_user_id: 'U-unknown', display_name: '通りすがり' })])
    expect(row.display_name).toBe('通りすがり')
  })

  it('照合できず表示名も無ければ「ゲスト」にする', () => {
    const [row] = enrich([log({ id: 'l1', line_user_id: 'U-unknown', display_name: null })])
    expect(row.display_name).toBe('ゲスト')
  })

  it('同名の顧客が複数いる場合は名前で紐づけない（取り違えを防ぐ）', () => {
    const dupes = [
      customer({ id: 'c1', line_user_id: 'U-1', display_name: 'あ' }),
      customer({ id: 'c2', line_user_id: 'U-2', display_name: 'あ' }),
    ]
    const dupMaps = buildCustomerLookupMaps(dupes)
    const [row] = enrichLogsWithCustomerLabels(
      [log({ id: 'l1', line_user_id: 'U-unknown', display_name: 'あ' })],
      dupes,
      dupMaps.byLineUserId,
      dupMaps.byDisplayName,
      dupMaps.byRealName,
    )
    expect(row.display_name).toBe('あ')
  })

  it('元のログの他の項目は保つ', () => {
    const [row] = enrich([log({ id: 'l1', line_user_id: 'U-1', message_content: 'こんにちは' })])
    expect(row).toMatchObject({ id: 'l1', message_content: 'こんにちは' })
  })

  it('ログが無ければ空のまま返す', () => {
    expect(enrich([])).toEqual([])
  })
})
