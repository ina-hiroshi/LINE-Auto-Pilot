import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { ClientVisibleError, clientVisibleErrorResponse, safeErrorResponse } from '../_shared/error-utils.ts'
import { loadStoreKnowledge, type StoreKnowledge } from '../_shared/store-knowledge.ts'
import { generateSocialReply } from '../_shared/social-reply-ai.ts'
import type { SocialReplyMessage } from '../_shared/social-reply-prompt.ts'

/**
 * DM の AI 返信文を作る。どちらの用途でも、このFunctionは一切送信を行わない。
 *
 * - { conversationId } … DM 受信箱の「AI下書き」。会話の直近メッセージから
 *   返信案を1件作り、フォームに入れるだけ（送信は social-send-reply が人の操作で行う）。
 * - { previewMessages } … 自動応答画面のプレビュー。AI 自動応答（social-dm-poll）と
 *   同じ mode:'auto' で生成し、「実際に届いたらこう返す／人に回す」を確認させる。
 *
 * どちらも LINE の AI 応答と同じ学習データ（knowledge_base）を参照する。
 */

const MAX_PREVIEW_MESSAGES = 10
const MAX_PREVIEW_TEXT_LENGTH = 1000

/** marketing_settings.knowledge_store_id → 無ければ呼び出した管理者自身の店舗。 */
async function resolveKnowledge(admin: SupabaseClient, userId: string): Promise<StoreKnowledge | null> {
  const { data: settings } = await admin
    .from('marketing_settings')
    .select('knowledge_store_id')
    .eq('id', 'global')
    .maybeSingle()
  let storeId = settings?.knowledge_store_id as string | null | undefined
  if (!storeId) {
    const { data: store } = await admin.from('stores').select('id').eq('owner_id', userId).maybeSingle()
    storeId = store?.id
  }
  return storeId ? await loadStoreKnowledge(admin, storeId) : null
}

function parsePreviewMessages(value: unknown): SocialReplyMessage[] | null {
  if (!Array.isArray(value)) return null
  const messages = value
    .slice(-MAX_PREVIEW_MESSAGES)
    .filter((m): m is { direction: string; text: string } =>
      typeof m === 'object' && m !== null && typeof m.text === 'string' && m.text.trim().length > 0)
    .map((m) => ({
      direction: m.direction === 'outbound' ? 'outbound' as const : 'inbound' as const,
      text: m.text.slice(0, MAX_PREVIEW_TEXT_LENGTH),
    }))
  return messages.length > 0 && messages[messages.length - 1].direction === 'inbound' ? messages : null
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const conversationId = body?.conversationId
    const previewMessages = body?.previewMessages !== undefined ? parsePreviewMessages(body.previewMessages) : undefined

    if (previewMessages === null) {
      throw new ClientVisibleError('プレビューするメッセージを入力してください', 400)
    }
    if (previewMessages === undefined && (typeof conversationId !== 'string' || !conversationId)) {
      throw new ClientVisibleError('conversationId が指定されていません', 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const access = await requireAdmin(req, admin, corsHeaders)
    if (!access.ok) return access.response

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY is not set')
      throw new ClientVisibleError('AI機能が設定されていません', 500)
    }

    const knowledge = await resolveKnowledge(admin, access.userId)
    const knowledgeInput = {
      storeName: knowledge?.storeName ?? null,
      knowledgeText: knowledge?.text ?? null,
      tone: knowledge?.tone,
      personaPrompt: knowledge?.personaPrompt ?? null,
    }

    let result
    if (previewMessages) {
      result = await generateSocialReply(geminiApiKey, {
        ...knowledgeInput,
        platform: 'instagram',
        displayName: 'お客様',
        recentMessages: previewMessages,
        mode: 'auto',
      }).catch((e) => {
        console.error('Failed to generate AI preview:', e instanceof Error ? e.message : String(e))
        throw new ClientVisibleError('AI応答の生成に失敗しました。少し時間をおいてお試しください。', 502)
      })
    } else {
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

      const displayName =
        (conversation.social_identities as unknown as { display_name: string | null } | null)?.display_name ?? null

      result = await generateSocialReply(geminiApiKey, {
        ...knowledgeInput,
        platform: conversation.platform as 'instagram' | 'facebook',
        displayName,
        recentMessages: (messages ?? []).reverse(),
        mode: 'draft',
      }, { temperature: 0.7 }).catch((e) => {
        console.error('Failed to generate AI draft:', e instanceof Error ? e.message : String(e))
        return null
      })
      if (!result?.draft) {
        throw new ClientVisibleError('下書きの生成に失敗しました。少し時間をおいてお試しください。', 502)
      }
    }

    return new Response(JSON.stringify({ draft: result.draft, needsHuman: result.needsHuman }), {
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
