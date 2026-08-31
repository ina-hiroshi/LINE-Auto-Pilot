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
/**
 * 名前 → customers.id の索引を作る。
 * LINE の表示名も本名も一意ではないので、同名が複数いる名前は索引から落とす。
 * 後勝ちで残すと、3人目の同名ユーザーのトークが無関係な顧客に紐づいてしまう。
 */
function indexUniqueNames(
  entries: Array<{ name: string | null | undefined; id: string }>,
): Record<string, string> {
  const index: Record<string, string> = {}
  const ambiguous = new Set<string>()

  for (const { name, id } of entries) {
    const key = name?.trim()
    if (!key || ambiguous.has(key)) continue

    const existing = index[key]
    if (existing !== undefined && existing !== id) {
      delete index[key]
      ambiguous.add(key)
      continue
    }
    index[key] = id
  }

  return index
}

export function buildCustomerLookupMaps(customers: CustomerLookupRow[]) {
  const byLineUserId: Record<string, string> = {}
  for (const c of customers) {
    byLineUserId[c.line_user_id] = c.id
  }

  const byDisplayName = indexUniqueNames(customers.map((c) => ({ name: c.display_name, id: c.id })))
  const byRealName = indexUniqueNames(customers.map((c) => ({ name: c.real_name, id: c.id })))

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
