/**
 * トークン更新タイミングの判定ロジック。純粋関数に切り出してユニットテストする。
 */

/** IG の refresh_access_token は発行/前回更新から24時間未満だと失敗する制約がある。 */
const IG_MIN_REFRESH_AGE_MS = 24 * 60 * 60 * 1000

/** 失効までこの期間を切ったら needs_reauth にしてメールする。
 *  20日マージンで週1回失敗しても間に合う設計だが、ここは「本当に危ない」ラインとして
 *  14日を採用する（計画の 0-4 節）。 */
const REAUTH_WARNING_MS = 14 * 24 * 60 * 60 * 1000

export function shouldRefreshInstagram(lastRefreshedAt: string | null, now: Date): boolean {
  if (!lastRefreshedAt) return true
  const age = now.getTime() - new Date(lastRefreshedAt).getTime()
  return age >= IG_MIN_REFRESH_AGE_MS
}

export function isNearingExpiry(expiresAt: string | null, now: Date): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() - now.getTime() <= REAUTH_WARNING_MS
}

/** 既存の自動投稿が依存しているスコープ。これが消えていたら投稿そのものが壊れている。 */
export const CRITICAL_FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
] as const

/** 広告ダッシュボード・DM のために再認可で追加を要求するスコープ。
 *  現行トークンには無いのが前提（再認可待ち）なので、無くてもアラートにはしない。 */
export const EXTENDED_FACEBOOK_SCOPES = [
  'pages_messaging',
  'pages_manage_metadata',
  'read_insights',
  'ads_read',
  'business_management',
] as const

export type ScopeCheck = { missingCritical: string[]; missingExtended: string[] }

export function checkFacebookScopes(scopes: string[] | null | undefined): ScopeCheck {
  const have = new Set(scopes ?? [])
  return {
    missingCritical: CRITICAL_FACEBOOK_SCOPES.filter((s) => !have.has(s)),
    missingExtended: EXTENDED_FACEBOOK_SCOPES.filter((s) => !have.has(s)),
  }
}
