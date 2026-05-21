import { supabase } from '../../../lib/supabase'

export type CustomerLookupRow = {
  id: string
  line_user_id: string
  display_name: string | null
  real_name: string | null
}

export type LogForCustomerResolve = {
  line_user_id: string
  display_name?: string | null
}

/** customers 一覧から line_user_id / 表示名 / 本名 のルックアップ表を構築 */
export function buildCustomerLookupMaps(customers: CustomerLookupRow[]) {
  const byLineUserId: Record<string, string> = {}
  const byDisplayName: Record<string, string> = {}
  const byRealName: Record<string, string> = {}

  for (const c of customers) {
    byLineUserId[c.line_user_id] = c.id
    const lineName = c.display_name?.trim()
    if (lineName) byDisplayName[lineName] = c.id
    const realName = c.real_name?.trim()
    if (realName) byRealName[realName] = c.id
  }

  return { byLineUserId, byDisplayName, byRealName }
}

function matchLogToCustomerId(
  log: LogForCustomerResolve,
  byDisplayName: Record<string, string>,
  byRealName: Record<string, string>,
): string | null {
  const name = log.display_name?.trim()
  if (!name) return null
  if (byDisplayName[name]) return byDisplayName[name]
  if (byRealName[name]) return byRealName[name]
  return null
}

/**
 * customer_logs の line_user_id（Messaging API）を customers.id に解決。
 */
export function augmentLineUserIdMapFromLogs(
  logs: LogForCustomerResolve[],
  byLineUserId: Record<string, string>,
  byDisplayName: Record<string, string>,
  byRealName: Record<string, string>,
): Record<string, string> {
  const map = { ...byLineUserId }

  for (const log of logs) {
    if (map[log.line_user_id]) continue
    const matched = matchLogToCustomerId(log, byDisplayName, byRealName)
    if (matched) map[log.line_user_id] = matched
  }

  return map
}

export function resolveCustomerIdFromLog(
  log: LogForCustomerResolve,
  lineUserIdMap: Record<string, string>,
  byDisplayName: Record<string, string>,
  byRealName: Record<string, string> = {},
): string | null {
  if (lineUserIdMap[log.line_user_id]) return lineUserIdMap[log.line_user_id]
  return matchLogToCustomerId(log, byDisplayName, byRealName)
}

export async function fetchCustomerIdByLineUserId(
  storeId: string,
  lineUserId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('store_id', storeId)
    .eq('line_user_id', lineUserId)
    .maybeSingle()

  if (error) {
    console.error('resolveCustomer:', error)
    return null
  }
  return data?.id ?? null
}

export async function fetchCustomerIdForLog(
  storeId: string,
  log: LogForCustomerResolve,
  lineUserIdMap: Record<string, string>,
  byDisplayName: Record<string, string>,
  byRealName: Record<string, string> = {},
): Promise<string | null> {
  const cached = resolveCustomerIdFromLog(log, lineUserIdMap, byDisplayName, byRealName)
  if (cached) return cached

  const name = log.display_name?.trim()
  if (name) {
    const { data: byLine } = await supabase
      .from('customers')
      .select('id')
      .eq('store_id', storeId)
      .eq('display_name', name)
      .maybeSingle()
    if (byLine?.id) return byLine.id

    const { data: byReal } = await supabase
      .from('customers')
      .select('id')
      .eq('store_id', storeId)
      .eq('real_name', name)
      .maybeSingle()
    if (byReal?.id) return byReal.id
  }

  return fetchCustomerIdByLineUserId(storeId, log.line_user_id)
}
