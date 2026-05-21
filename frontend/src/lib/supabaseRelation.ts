/** PostgREST の embed が配列/オブジェクトどちらでも返る場合の name 取得 */
export function pickEmbeddedName(rel: unknown): string | null {
  if (!rel) return null
  if (Array.isArray(rel)) {
    const first = rel[0] as { name?: string } | undefined
    return first?.name ?? null
  }
  if (typeof rel === 'object' && 'name' in rel) {
    return String((rel as { name: string }).name)
  }
  return null
}
