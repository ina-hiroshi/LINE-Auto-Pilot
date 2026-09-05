import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { ClientVisibleError, clientVisibleErrorResponse, safeErrorResponse } from '../_shared/error-utils.ts'
import { getToken, type CredentialId } from '../_shared/meta-tokens.ts'
import { evaluateManualWindow, type ManualSentBy } from '../_shared/meta-messaging-window.ts'
import { sendDirectMessage } from '../_shared/social-send.ts'

const MAX_TEXT_LENGTH = 1000

/**
 * DM 受信箱の返信フォーム（手動送信・AI下書き承認送信）。
 *
 * 自動応答（social-outbound-drain）とは別経路。人がボタンを押した
 * その場で同期的に送るため、キューを経由しない。ウィンドウ判定は
 * 必ず evaluateManualWindow を使う（自動側の evaluateAutomatedWindow は
 * ここでは絶対に呼ばない＝HUMAN_AGENT を返せるのはこの経路だけ）。
 *
 * sentBy は呼び出し側（フロント）が 'manual' か 'ai_draft_approved' を
 * 明示する。AI下書きをそのまま押しただけでも、人がボタンを押した時点で
 * 送信者は「人」であり、記録上だけ ai_draft_approved で区別する。
 */
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { conversationId, text, sentBy } = await req.json()

    if (typeof conversationId !== 'string' || !conversationId) {
      throw new ClientVisibleError('conversationId が指定されていません', 400)
    }
    const trimmedText = typeof text === 'string' ? text.trim() : ''
    if (!trimmedText) {
      throw new ClientVisibleError('本文を入力してください', 400)
    }
    if (trimmedText.length > MAX_TEXT_LENGTH) {
      throw new ClientVisibleError(`本文は${MAX_TEXT_LENGTH}文字以内で入力してください`, 400)
    }
    const resolvedSentBy: ManualSentBy = sentBy === 'ai_draft_approved' ? 'ai_draft_approved' : 'manual'

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const access = await requireAdmin(req, admin, corsHeaders)
    if (!access.ok) return access.response

    const { data: conversation, error: conversationError } = await admin
      .from('social_conversations')
      .select('id, platform, account_ref, last_inbound_at, social_identities(external_id)')
      .eq('id', conversationId)
      .single()
    if (conversationError || !conversation) {
      throw new ClientVisibleError('会話が見つかりません', 404)
    }

    const decision = evaluateManualWindow(conversation.last_inbound_at)
    if (!decision.allowed) {
      const reasonLabel =
        decision.reason === 'no_inbound'
          ? 'この会話にはまだ受信メッセージがありません'
          : '返信可能な期間（受信から7日以内）を過ぎています'
      throw new ClientVisibleError(reasonLabel, 409)
    }

    const recipientId = (conversation.social_identities as unknown as { external_id: string } | null)?.external_id
    if (!recipientId) {
      throw new ClientVisibleError('送信先が特定できません', 500)
    }

    const credentialId: CredentialId = conversation.platform === 'instagram' ? 'instagram_login' : 'facebook_page'
    const lookup = await getToken(admin, credentialId)
    if (!lookup) {
      throw new ClientVisibleError('送信用のトークンが設定されていません', 500)
    }

    const result = await sendDirectMessage(
      { platform: conversation.platform, accountRef: conversation.account_ref, recipientId, token: lookup.token },
      trimmedText,
      decision.tag,
    )

    // 送信結果は監査ログとして social_outbound_queue にも残す（このFunction自身は
    // キューを経由せず同期送信するが、履歴を一元化するため事後に1行だけ書く）。
    await admin.from('social_outbound_queue').insert({
      conversation_id: conversationId,
      idempotency_key: `manual-${conversationId}-${Date.now()}`,
      recipient: { id: recipientId },
      message: { text: trimmedText },
      sent_by: resolvedSentBy,
      status: result.ok ? 'sent' : 'failed',
      last_error: result.ok ? null : `send failed (${result.status}): ${JSON.stringify(result.error)}`,
      sent_at: result.ok ? new Date().toISOString() : null,
    })

    if (!result.ok) {
      console.error('social-send-reply: send failed', result.status, result.error)
      throw new ClientVisibleError('送信に失敗しました。時間をおいて再度お試しください。', 502)
    }

    return new Response(JSON.stringify({ ok: true, tag: decision.tag }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    if (error instanceof ClientVisibleError) {
      return clientVisibleErrorResponse(error, corsHeaders)
    }
    return safeErrorResponse(error, corsHeaders)
  }
})
