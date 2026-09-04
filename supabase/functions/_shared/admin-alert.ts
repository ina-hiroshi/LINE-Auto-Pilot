/**
 * 運営（管理者）宛の障害アラート。
 *
 * 無人で動く処理が黙って失敗するのを防ぐためのもの。2026-09-04 に
 * Facebook のトークン失効で投稿が落ちたとき、記録は social_posts.error 列に
 * 残っていたが誰にも届かず、気づかれたのは翌日だった。
 *
 * 依存を持たない（import map 不要）。通知の失敗で呼び出し元を巻き添えに
 * しないよう、この関数は決して throw しない。
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/** ADMIN_EMAILS（_shared/admin-check.ts, useUserFeatures.tsx）と揃えること。 */
const DEFAULT_ADMIN_EMAIL = 'sky.voltric424@gmail.com'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type AlertResult = { sent: boolean; reason?: string }

/**
 * @param subject 件名（`[IToguchi]` の接頭辞は自動で付く）
 * @param lines   本文。1要素 = 1行。
 */
export async function sendAdminAlert(subject: string, lines: string[]): Promise<AlertResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.error('[admin-alert] RESEND_API_KEY is not set; alert not sent:', subject)
    return { sent: false, reason: 'missing RESEND_API_KEY' }
  }

  const from = Deno.env.get('RESEND_FROM_EMAIL') || 'IToguchi <onboarding@resend.dev>'
  const to = Deno.env.get('ADMIN_ALERT_EMAIL') || DEFAULT_ADMIN_EMAIL

  const html = [
    '<div style="font-family:sans-serif;font-size:14px;line-height:1.7">',
    `<p style="font-weight:bold;margin:0 0 12px">${escapeHtml(subject)}</p>`,
    ...lines.map((l) => `<p style="margin:0 0 6px">${escapeHtml(l)}</p>`),
    '<hr style="border:none;border-top:1px solid #eee;margin:16px 0">',
    '<p style="color:#888;margin:0">IToguchi 管理システムからの自動通知です。</p>',
    '</div>',
  ].join('')

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: `[IToguchi] ${subject}`, html }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[admin-alert] resend returned', res.status, body.slice(0, 300))
      return { sent: false, reason: `resend ${res.status}` }
    }
    return { sent: true }
  } catch (e) {
    // 通知の失敗で本来の処理を巻き添えにしない
    console.error('[admin-alert] failed to send:', e instanceof Error ? e.message : String(e))
    return { sent: false, reason: 'fetch failed' }
  }
}
