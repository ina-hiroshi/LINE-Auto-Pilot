import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

// モニター申込フォームからの申込を運営に通知し、申込者へ受付確認を返す。
// 公開フォーム（未ログイン）から呼ばれるため、送信先は DB に保存済みの値のみを使い、
// リクエスト本文で宛先を受け取らない（メール中継として悪用されないようにするため）。

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADMIN_EMAIL = Deno.env.get('MONITOR_APPLICATION_NOTIFY_EMAIL') || 'itoguchi.app@gmail.com'

interface RequestBody {
  application_id: string
}

/**
 * 旧コース選択のラベル。2026-08-29 に特典を「初期設定代行 無料」の1本へ統一し、
 * 新規申込の course は NULL になる。過去の申込を表示するためだけに残している。
 */
const COURSE_LABELS: Record<string, string> = {
  omakase: 'おまかせ導入コース（初期設定代行 無料 + Pro 初月無料）',
  jikkuri: 'じっくりお得コース（初期設定代行 有料 + Pro 3ヶ月無料）',
}

const BENEFIT_LABEL = '初期設定代行（¥9,980）が無料'

/** メール本文に埋め込む申込者入力をエスケープする（HTML インジェクション防止） */
function escapeHtml(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sendEmail(
  from: string,
  to: string,
  subject: string,
  html: string,
  replyTo?: string,
): Promise<void> {
  const payload: Record<string, unknown> = { from, to, subject, html }
  if (replyTo) payload.reply_to = replyTo

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Resend error ${res.status}: ${errorText}`)
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { application_id }: RequestBody = await req.json()

    if (!application_id) {
      return new Response(
        JSON.stringify({ error: 'application_idが必要です' }),
        { status: 400, headers: jsonHeaders },
      )
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set')
      return new Response(
        JSON.stringify({ error: 'メール送信の設定がされていません' }),
        { status: 500, headers: jsonHeaders },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: application, error: fetchError } = await supabase
      .from('monitor_applications')
      .select('*')
      .eq('id', application_id)
      .single()

    if (fetchError || !application) {
      console.error('Monitor application fetch error:', fetchError)
      return new Response(
        JSON.stringify({ error: '申込情報の取得に失敗しました' }),
        { status: 404, headers: jsonHeaders },
      )
    }

    // 送信済みなら何もしない（重複クリック・リプレイ送信の防止）
    if (application.notified_at) {
      return new Response(
        JSON.stringify({ success: true, skipped: 'already_notified' }),
        { status: 200, headers: jsonHeaders },
      )
    }

    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Acme <onboarding@resend.dev>'
    // course は新仕様で NULL になる。null のまま split すると例外で通知が丸ごと落ちるため、
    // 特典名にフォールバックする。
    const courseLabel = application.course
      ? (COURSE_LABELS[application.course] || application.course)
      : BENEFIT_LABEL

    // 1) 運営への申込通知（本命。これが届かないと申込に気づけない）
    const adminHtml = `
      <div style="font-family:sans-serif;line-height:1.7;color:#0f172a">
        <h2 style="margin:0 0 16px">モニター申込が届きました</h2>
        <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
          <tr><td style="color:#64748b">店舗名</td><td><strong>${escapeHtml(application.store_name)}</strong></td></tr>
          <tr><td style="color:#64748b">業種</td><td>${escapeHtml(application.industry)}</td></tr>
          <tr><td style="color:#64748b">ご担当者</td><td>${escapeHtml(application.contact_name)}</td></tr>
          <tr><td style="color:#64748b">メール</td><td>${escapeHtml(application.email)}</td></tr>
          <tr><td style="color:#64748b">電話</td><td>${escapeHtml(application.phone)}</td></tr>
          <tr><td style="color:#64748b">LINE公式アカウント</td><td>${application.has_line_account ? 'あり' : 'なし'}</td></tr>
          <tr><td style="color:#64748b">特典</td><td>${escapeHtml(courseLabel)}</td></tr>
          <tr><td style="color:#64748b">インタビュー同意</td><td>${application.agreed_to_interview ? '同意済み' : '未同意'}</td></tr>
        </table>
        <p style="margin:16px 0 4px;color:#64748b;font-size:14px">メッセージ</p>
        <div style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px;font-size:14px">${escapeHtml(application.message)}</div>
        <p style="margin-top:24px;font-size:13px;color:#64748b">
          申込ID: ${escapeHtml(application.id)}<br>
          管理画面の「モニター申込」タブからステータスを更新してください。
        </p>
      </div>
    `
    await sendEmail(
      fromEmail,
      ADMIN_EMAIL,
      `【モニター申込】${application.store_name}`,
      adminHtml,
      application.email,
    )

    // 2) 申込者への受付確認（届かなくても申込自体は成立しているため、失敗しても全体は成功扱い）
    let applicantEmailFailed = false
    try {
      const applicantHtml = `
        <div style="font-family:sans-serif;line-height:1.7;color:#0f172a">
          <p>${escapeHtml(application.contact_name)} 様</p>
          <p>この度は IToguchi のモニターにお申し込みいただき、ありがとうございます。<br>
          以下の内容でお申し込みを承りました。</p>
          <table cellpadding="6" style="border-collapse:collapse;font-size:14px;background:#f8fafc;border-radius:8px">
            <tr><td style="color:#64748b">店舗名</td><td>${escapeHtml(application.store_name)}</td></tr>
            <tr><td style="color:#64748b">特典</td><td>${escapeHtml(courseLabel)}</td></tr>
          </table>
          <p><strong>2営業日以内に</strong>初期設定の進め方についてご連絡いたします。<br>
          今しばらくお待ちくださいませ。</p>
          <p style="font-size:13px;color:#64748b">
            ※このメールに心当たりがない場合は、破棄していただけますと幸いです。<br>
            ※ご返信いただければ担当に直接届きます。
          </p>
          <p style="margin-top:24px">IToguchi</p>
        </div>
      `
      await sendEmail(
        fromEmail,
        application.email,
        '【IToguchi】モニターのお申し込みを承りました',
        applicantHtml,
        ADMIN_EMAIL,
      )
    } catch (e) {
      applicantEmailFailed = true
      console.error('Applicant confirmation email failed:', e)
    }

    const { error: updateError } = await supabase
      .from('monitor_applications')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', application_id)

    if (updateError) {
      console.error('notified_at update error:', updateError)
    }

    return new Response(
      JSON.stringify({ success: true, applicant_email_failed: applicantEmailFailed }),
      { status: 200, headers: jsonHeaders },
    )
  } catch (error) {
    console.error('notify-monitor-application error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '通知の送信に失敗しました' }),
      { status: 500, headers: jsonHeaders },
    )
  }
})
