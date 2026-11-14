// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { ClientVisibleError, clientVisibleErrorResponse, safeErrorResponse } from '../_shared/error-utils.ts'
import { generateAIResponse } from '../_shared/ai-reply.ts'

// Helper to generate AI response using Gemini API
import { requireStoreAccess } from '../_shared/store-access.ts'
import { validatePreviewInput, requirePaidAiPlan, reserveAiGeneration } from '../_shared/ai-generation-policy.ts'


Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Use Service Role Key to ensure we can read knowledge base regardless of RLS for this system function
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? ''

    if (!supabaseServiceKey || !geminiApiKey) {
        throw new Error('Missing API Keys')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })

    const { message, store_id, ai_settings } = await req.json()

    if (!message) {
      throw new Error('Message is required')
    }

    if (!store_id) {
      throw new Error('store_id is required')
    }

    // 無認証だと store_id を差し替えるだけで他店舗の AI 学習データ（knowledge_base）を
    // AI に読み上げさせて抜き出せる。ai_settings も呼び出し元が自由に指定できるため、
    // システムプロンプトごと乗っ取られる。オーナー本人か管理者に限定する。
    const access = await requireStoreAccess(req, store_id, supabase, corsHeaders)
    if (!access.ok) return access.response

    const validated = validatePreviewInput(message, ai_settings)
    await requirePaidAiPlan(supabase, store_id)
    await reserveAiGeneration(supabase, store_id, 'ai-chat-preview')
    const reply = await generateAIResponse(geminiApiKey, validated.message, validated.settings, store_id, supabase)

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    if (error instanceof ClientVisibleError) return clientVisibleErrorResponse(error, corsHeaders)
    return safeErrorResponse(error, corsHeaders, 400, 'Invalid request')
  }
})
