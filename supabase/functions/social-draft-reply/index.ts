import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { ClientVisibleError, clientVisibleErrorResponse, safeErrorResponse } from '../_shared/error-utils.ts'
import { getGeminiUrl } from '../_shared/ai-config.ts'
import { buildSocialReplyPrompt, parseSocialReplyDraft } from '../_shared/social-reply-prompt.ts'

/**
 * DM 受信箱の「AI下書き」ボタン。会話の直近メッセージから返信案を1件作る。
 *
 * 生成結果はここから返してフォームに入れるだけで、このFunctionは
 * 一切送信を行わない（送信は social-send-reply が別途、人の操作で行う）。
 */
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { conversationId } = await req.json()
    if (typeof conversationId !== 'string' || !conversationId) {
      throw new ClientVisibleError('conversationId が指定されていません', 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const access = await requireAdmin(req, admin, corsHeaders)
    if (!access.ok) return access.response

    const { data: conversation, error: conversationError } = await admin
      .from('social_conversations')
      .select('id, platform, social_identities(display_name)')
      .eq('id', conversationId)
      .single()
    if (conversationError || !conversation) {
      throw new ClientVisibleError('会話が見つかりません', 404)
    }

    const { data: messages, error: messagesError } = await admin
      .from('social_messages')
      .select('direction, text')
      .eq('conversation_id', conversationId)
      .order('occurred_at', { ascending: false })
      .limit(10)
    if (messagesError) throw messagesError

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY is not set')
      throw new ClientVisibleError('AI機能が設定されていません', 500)
    }

    const displayName =
      (conversation.social_identities as unknown as { display_name: string | null } | null)?.display_name ?? null

    const prompt = buildSocialReplyPrompt({
      storeName: null,
      platform: conversation.platform as 'instagram' | 'facebook',
      displayName,
      recentMessages: (messages ?? []).reverse(),
    })

    const response = await fetch(getGeminiUrl(geminiApiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
      }),
    })

    if (!response.ok) {
      console.error('Gemini API Error:', await response.text())
      throw new ClientVisibleError('下書きの生成に失敗しました。少し時間をおいてお試しください。', 502)
    }

    const data = await response.json()
    const aiText: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const draft = parseSocialReplyDraft(aiText)

    if (!draft) {
      console.error('Failed to parse AI draft response:', aiText)
      throw new ClientVisibleError('下書きの生成に失敗しました。少し時間をおいてお試しください。', 502)
    }

    return new Response(JSON.stringify({ draft }), {
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
