/**
 * LIFF のエンドポイントがサイトルート（/）のとき、
 * LINE からの1次リダイレクトは常に `/` に着地する。
 * 予約・会員証へ送るべきアクセスかどうかを判定する。
 */
export function looksLikeLiffEntryAtRoot(
  pathname: string,
  search: string,
  hash: string,
): boolean {
  if (pathname !== '/' && pathname !== '') return false

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (params.has('store_id') || params.get('page') === 'member-card') return true
  if (params.has('liff.state') || params.has('liffClientId')) return true
  return /access_token|id_token|context_token/.test(hash)
}

export function liffEntryDestination(search: string): string | null {
  const raw = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(raw)
  const query = raw ? `?${raw}` : ''

  if (params.get('page') === 'member-card') {
    return `/member-card${query}`
  }
  if (params.has('store_id')) {
    return `/booking${query}`
  }
  return null
}
