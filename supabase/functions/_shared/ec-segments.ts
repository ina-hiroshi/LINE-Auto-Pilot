/** EC segments require an explicit positive PostgreSQL integer; absent inputs select nobody. */
export function validateEcSegmentParams(segmentType: unknown, params: unknown): boolean {
  const key = segmentType === 'ec_recent' ? 'recent_days' : segmentType === 'ec_dormant' ? 'dormant_days' : segmentType === 'ec_high_spender' ? 'top_n' : null
  if (!key) return true
  if (!params || typeof params !== 'object' || Array.isArray(params)) return false
  const value = (params as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2147483647
}
