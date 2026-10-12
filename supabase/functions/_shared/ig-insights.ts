/**
 * Instagram Graph API（Instagram Login、graph.instagram.com）のインサイト応答を読む部品。
 *
 * social-ig-insights が使う。ネットワークには触れない純粋な関数だけを置き、
 * テストで形を固定する。
 */

export type GraphError = { message?: string; code?: number; error_subcode?: number; type?: string }

export type GraphInsightsResponse = {
  data?: Array<{
    name?: string
    values?: Array<{ value?: number }>
    total_value?: { value?: number }
  }>
  error?: GraphError
}

/** insights の応答から指標1つの数値を取り出す。無い・数値でないときは null。 */
export function pickInsightValue(res: GraphInsightsResponse | null | undefined, name: string): number | null {
  const row = res?.data?.find((d) => d.name === name)
  if (!row) return null
  const v = row.total_value?.value ?? row.values?.[0]?.value
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** エラーを「code: message」の短い文字列にする（URL やトークンは含めない）。 */
export function describeGraphError(err: GraphError | null | undefined): string {
  if (!err) return 'unknown error'
  const head = err.code != null ? `code ${err.code}${err.error_subcode ? `/${err.error_subcode}` : ''}` : 'error'
  return `${head}: ${(err.message ?? '').slice(0, 200)}`
}

export type ErrorKind = 'permission' | 'unsupported' | 'other'

/**
 * 権限不足か、対象外（フォロワー数の下限や投稿の種類）かを、メッセージで見分ける。
 * 権限不足と確認できたときだけ、本人に再認可を頼む。
 */
export function classifyGraphError(err: GraphError | null | undefined): ErrorKind {
  if (!err) return 'other'
  const msg = (err.message ?? '').toLowerCase()
  if (err.code === 10 || err.code === 200 || err.code === 190 || msg.includes('permission') || msg.includes('scope')) {
    return 'permission'
  }
  if (
    msg.includes('not support') ||
    msg.includes('does not support') ||
    msg.includes('not available') ||
    msg.includes('follower') ||
    msg.includes('invalid metric')
  ) {
    return 'unsupported'
  }
  return 'other'
}

/** 日本時間の日付（YYYY-MM-DD）。スナップショットの日付に使う。 */
export function jstDate(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
