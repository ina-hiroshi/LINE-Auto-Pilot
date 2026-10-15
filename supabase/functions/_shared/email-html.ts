/** メール本文に埋め込む申込者入力をエスケープする（HTML インジェクション防止） */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

