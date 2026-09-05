import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { getToken, type CredentialId } from '../_shared/meta-tokens.ts'
import { evaluateAutomatedWindow } from '../_shared/meta-messaging-window.ts'
import { sendDirectMessage } from '../_shared/social-send.ts'

const MAX_ATTEMPTS = 3

/**
 * social_outbound_queue の 'pending' 行（自動応答経路のみ）をドレインする。
 *
 * 'pending' に積まれるのは social-dm-poll がキーワードルールにマッチさせた
 * 自動応答だけ（sent_by: 'keyword_rule' / 将来の 'private_reply'）。
 * 手動送信・AI下書き承認送信は social-send-reply から同期的に送るため、
 * ここでは扱わない（自動系だけを扱うことで、送信直前の再判定を
 * evaluateAutomatedWindow 一本に絞れる＝HUMAN_AGENT に倒れる経路が無い）。
 *
 * キューに積まれた時点では 24h 以内でも、送信が実行されるまでの間に
 * ウィンドウが閉じることがあるため、送信直前に last_inbound_at を
 * 読み直して再評価する（黙って失敗させず 'skipped' + 理由を残す）。
 */
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const admin: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // social-dm-poll / marketing-ads と同じ二重受付。
    const cronSecret = Deno.env.get('SOCIAL_CRON_SECRET')
    const providedSecret = req.headers.get('x-cron-secret')
    const isCron = !!cronSecret && providedSecret === cronSecret
    if (!isCron) {
      const access = await requireAdmin(req, admin, corsHeaders)
      if (!access.ok) return access.response
    }

    const { data: rows, error: rowsError } = await admin
      .from('social_outbound_queue')
      .select(
        'id, conversation_id, recipient, message, attempts, social_conversations(platform, account_ref, last_inbound_at)',
      )
      .eq('status', 'pending')
      .in('sent_by', ['keyword_rule', 'private_reply'])
      .order('created_at', { ascending: true })
      .limit(50)
    if (rowsError) throw rowsError

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const row of rows ?? []) {
      const conv = row.social_conversations as unknown as {
        platform: 'instagram' | 'facebook'
        account_ref: string
        last_inbound_at: string | null
      } | null
      if (!conv) {
        // 会話が消えている（想定外）。再試行しても直らないため failed で止める。
        await admin.from('social_outbound_queue').update({ status: 'failed', last_error: 'conversation not found' }).eq('id', row.id)
        failed += 1
        continue
      }

      const decision = evaluateAutomatedWindow(conv.last_inbound_at)
      if (!decision.allowed) {
        await admin
          .from('social_outbound_queue')
          .update({ status: 'skipped', last_error: `window: ${decision.reason}` })
          .eq('id', row.id)
        skipped += 1
        continue
      }

      const credentialId: CredentialId = conv.platform === 'instagram' ? 'instagram_login' : 'facebook_page'
      const lookup = await getToken(admin, credentialId)
      if (!lookup) {
        await admin
          .from('social_outbound_queue')
          .update({ status: 'failed', last_error: 'token not configured' })
          .eq('id', row.id)
        failed += 1
        continue
      }

      const recipient = row.recipient as { id?: string } | null
      const message = row.message as { text?: string } | null
      if (!recipient?.id || !message?.text) {
        await admin
          .from('social_outbound_queue')
          .update({ status: 'failed', last_error: 'malformed recipient/message' })
          .eq('id', row.id)
        failed += 1
        continue
      }

      const result = await sendDirectMessage(
        { platform: conv.platform, accountRef: conv.account_ref, recipientId: recipient.id, token: lookup.token },
        message.text,
        // decision.tag は自動経路では常に null（evaluateAutomatedWindow の型が
        // そう返す）。HUMAN_AGENT はここに来る余地が無い。
        decision.tag,
      )

      if (result.ok) {
        await admin
          .from('social_outbound_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', row.id)
        sent += 1
      } else {
        const attempts = (row.attempts ?? 0) + 1
        const giveUp = attempts >= MAX_ATTEMPTS
        await admin
          .from('social_outbound_queue')
          .update({
            attempts,
            status: giveUp ? 'failed' : 'pending',
            last_error: `send failed (${result.status}): ${JSON.stringify(result.error)}`,
          })
          .eq('id', row.id)
        failed += 1
      }
    }

    return json({ ok: true, sent, skipped, failed, total: (rows ?? []).length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[social-outbound-drain]', message)
    return json({ error: message }, 500)
  }
})
