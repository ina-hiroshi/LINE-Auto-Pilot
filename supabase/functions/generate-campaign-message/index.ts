import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { ClientVisibleError, clientVisibleErrorResponse, safeErrorResponse } from '../_shared/error-utils.ts'
import { requireStoreAccess } from '../_shared/store-access.ts'
import { getGeminiUrl } from '../_shared/ai-config.ts'
import { boundedText, MAX_TARGET_DETAIL_LENGTH, reserveAiGeneration } from '../_shared/ai-generation-policy.ts'
import { isPaidPlan } from '../_shared/plan-utils.ts'
import {
  buildCampaignPrompt,
  type CampaignTone,
  parseCampaignVariations,
} from '../_shared/campaign-prompt.ts'

/**
 * 一斉配信メッセージの下書きを AI に作らせる。
 *
 * dashboard-ai-analysis と同じく Pro / Executive プラン限定。
 * 配信そのもの（send-line-bulk-message）は全プランで使える。
 */

const TONES: CampaignTone[] = ['friendly', 'polite', 'casual']

const MAX_PURPOSE_LENGTH = 200
const MAX_KEYWORDS_LENGTH = 200

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { storeId, segmentType, targetDetail, purpose, tone, keywords } = await req.json()

    if (!storeId) {
      throw new ClientVisibleError('店舗が指定されていません', 400)
    }

    const purposeText = typeof purpose === 'string' ? purpose.trim() : ''
    if (!purposeText) {
      throw new ClientVisibleError('配信の目的を入力してください', 400)
    }
    if (purposeText.length > MAX_PURPOSE_LENGTH) {
      throw new ClientVisibleError(`配信の目的は${MAX_PURPOSE_LENGTH}文字以内で入力してください`, 400)
    }

    const keywordsText = typeof keywords === 'string' ? keywords.trim() : ''
    if (keywordsText.length > MAX_KEYWORDS_LENGTH) {
      throw new ClientVisibleError(`盛り込む内容は${MAX_KEYWORDS_LENGTH}文字以内で入力してください`, 400)
    }

    const detailText = boundedText(targetDetail, MAX_TARGET_DETAIL_LENGTH, '配信対象の詳細')
    boundedText(segmentType, 100, '配信対象')

    const selectedTone: CampaignTone = TONES.includes(tone) ? tone : 'friendly'

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const access = await requireStoreAccess(req, storeId, admin, corsHeaders)
    if (!access.ok) return access.response

    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('owner_id, name, industry')
      .eq('id', storeId)
      .single()

    if (storeError || !store) {
      throw new ClientVisibleError('店舗が見つかりません', 404)
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('plan')
      .eq('id', store.owner_id)
      .single()

    if (!isPaidPlan(profile?.plan)) {
      // フロントはこのステータスを見て「Proプラン以上でご利用いただけます」を出す
      return new Response(
        JSON.stringify({
          error: 'AIによる文章作成はProプラン以上でご利用いただけます',
          currentPlan: profile?.plan ?? null,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY is not set')
      throw new ClientVisibleError('AI機能が設定されていません', 500)
    }

    const prompt = buildCampaignPrompt({
      storeName: store.name ?? null,
      industry: store.industry ?? null,
      segmentType: typeof segmentType === 'string' ? segmentType : 'all',
      targetDetail: detailText || null,
      purpose: purposeText,
      tone: selectedTone,
      keywords: keywordsText || null,
    })

    await reserveAiGeneration(admin, storeId, 'campaign-generator')

    const response = await fetch(getGeminiUrl(geminiApiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1200,
          temperature: 0.9,
        },
      }),
    })

    if (!response.ok) {
      console.error('Gemini API Error:', await response.text())
      throw new ClientVisibleError('文章の生成に失敗しました。少し時間をおいてお試しください。', 502)
    }

    const data = await response.json()
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const variations = parseCampaignVariations(aiText)

    if (variations.length === 0) {
      console.error('Failed to parse AI response:', aiText)
      throw new ClientVisibleError('文章の生成に失敗しました。少し時間をおいてお試しください。', 502)
    }

    return new Response(
      JSON.stringify({ variations: variations.map((text) => ({ text })) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    if (error instanceof ClientVisibleError) {
      return clientVisibleErrorResponse(error, corsHeaders)
    }
    return safeErrorResponse(error, corsHeaders)
  }
})
