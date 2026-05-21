import type { LogEntry } from '../../messaging/types'
import type { CustomerLookupRow, LogForCustomerResolve } from './resolveCustomer'
import { resolveCustomerIdFromLog } from './resolveCustomer'

/** UI 表示用: 本名を最優先 */
export function formatCustomerLabel(
  customer: { real_name?: string | null; display_name?: string | null } | null | undefined,
  fallback = 'ゲスト',
): string {
  if (!customer) return fallback
  const real = customer.real_name?.trim()
  if (real) return real
  const line = customer.display_name?.trim()
  if (line) return line
  return fallback
}

/** メッセージログの表示名を顧客マスタの本名に揃える */
export function enrichLogsWithCustomerLabels(
  logs: LogEntry[],
  customers: CustomerLookupRow[],
  lineUserIdMap: Record<string, string>,
  byDisplayName: Record<string, string>,
  byRealName: Record<string, string>,
): LogEntry[] {
  const customerById = new Map(customers.map((c) => [c.id, c]))

  return logs.map((log) => {
    const customerId = resolveCustomerIdFromLog(log, lineUserIdMap, byDisplayName, byRealName)
    const customer = customerId ? customerById.get(customerId) : undefined
    const label = formatCustomerLabel(customer, log.display_name ?? 'ゲスト')
    return { ...log, display_name: label }
  })
}

export type { LogForCustomerResolve }
