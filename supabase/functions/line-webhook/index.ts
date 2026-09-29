// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'
import { getGeminiUrl, KNOWLEDGE_BASE_MAX_CHARS } from '../_shared/ai-config.ts'
import { createLogger } from '../_shared/logger.ts'
import { isPaidPlan } from '../_shared/plan-utils.ts'
import { checkAiRateLimit, recordAiUsage, maybeCleanupRateLimits } from '../_shared/rate-limiter.ts'
import { selectAutoResponse, shouldDeferKeywordToAi } from '../_shared/auto-response.ts'
import { judgeKeywordReplyFit } from '../_shared/keyword-judge.ts'
import type { SupabaseClientType, AISettings } from '../_shared/types.ts'
import {
  MANUAL_REPLY_FALLBACK,
  MANUAL_REPLY_FALLBACK_COOLDOWN_HOURS,
  buildLogEntry,
  describeNonTextMessage,
  isBlankText,
  redactSecrets,
} from '../_shared/webhook-reply.ts'

const log = createLogger('line-webhook')

// ============ 定数定義 ============
const CONFIG = {
  /** LINE ローディングアニメーションの表示秒数 */
  LOADING_ANIMATION_SECONDS: 20,
  /** AI学習データの最大文字数（_shared/ai-config.ts が単一の情報源） */
  KNOWLEDGE_BASE_MAX_CHARS,
  /** Gemini API の最大出力トークン数 */
  GEMINI_MAX_OUTPUT_TOKENS: 500,
  /** Gemini API の温度パラメータ */
  GEMINI_TEMPERATURE: 0.4,
  /** Gemini API の待ち時間の上限。長引くと replyToken が失効して返信できなくなる */
  GEMINI_TIMEOUT_MS: 15000,
  RATE_LIMIT_FALLBACK: "お問い合わせありがとうございます。\nただいま多くのお問い合わせをいただいております。\n担当者が確認次第、返信させていただきます。",
} as const;

type LineTextMessage = { type: 'text'; text: string }
type LineMessage = LineTextMessage
type LineEvent = {
  type: string
  message?: { type: string; text?: string }
  replyToken?: string
  source?: { type?: string; userId?: string }
}

console.log("LINE Webhook Function Initialized")

// Helper to verify LINE signature using Web Crypto API
async function verifySignature(channelSecret: string, body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body)
  )
  const hash = btoa(String.fromCharCode(...new Uint8Array(signed)))
  return hash === signature
}

// Helper to reply message using fetch
async function replyMessage(accessToken: string, replyToken: string, messages: LineMessage[]) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: messages
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LINE API Error: ${response.status} ${errorText}`)
  }
}

// Helper to get user profile
async function getProfile(accessToken: string, userId: string): Promise<{ displayName: string, pictureUrl?: string } | null> {
  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    if (!response.ok) return null
    return await response.json()
  } catch (e) {
    console.error('Error fetching profile:', e)
    return null
  }
}

// Helper to start loading animation
async function startLoadingAnimation(accessToken: string, userId: string) {
  try {
    await fetch('https://api.line.me/v2/bot/chat/loading/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        chatId: userId,
        loadingSeconds: CONFIG.LOADING_ANIMATION_SECONDS
      })
    })
  } catch (e) {
    console.error('Error starting loading animation:', e)
    // Do not throw error to continue processing
  }
}

// Helper to generate AI response using Gemini API
import { generateSystemPrompt } from '../_shared/ai-prompt.ts'

async function generateAIResponse(
  apiKey: string,
  message: string,
  settings: AISettings,
  storeId: string,
  supabase: SupabaseClientType,
  userId?: string
): Promise<string | null> {
  try {
    // 1. Fetch Knowledge Base
    const { data: docs } = await supabase
      .from('knowledge_base')
      .select('extracted_text')
      .eq('store_id', storeId)
      .eq('is_active', true);
    
    let context = "";
    if (docs && docs.length > 0) {
      // Combine texts, limiting total length to avoid token limits (rough estimation)
      context = docs.map((d: { extracted_text?: string }) => d.extracted_text || "").join("\n\n").substring(0, CONFIG.KNOWLEDGE_BASE_MAX_CHARS);
    }

    // 2. Fetch conversation history (last 5 messages)
    let conversationHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    if (userId) {
      const { data: history } = await supabase
        .from('customer_logs')
        .select('message_content, reply_content')
        .eq('store_id', storeId)
        .eq('line_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (history && history.length > 0) {
        // Reverse to chronological order
        for (const h of history.reverse()) {
          conversationHistory.push({ role: 'user', parts: [{ text: h.message_content }] });
          if (h.reply_content) {
            conversationHistory.push({ role: 'model', parts: [{ text: h.reply_content }] });
          }
        }
      }
    }

    // 3. Generate System Prompt using shared function
    const systemPrompt = generateSystemPrompt(settings, context);

    // 4. Call Gemini API with optimized format
    const url = getGeminiUrl(apiKey);
    
    const contents = [
      ...conversationHistory,
      { role: 'user' as const, parts: [{ text: message }] }
    ];
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(CONFIG.GEMINI_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: contents,
        generationConfig: {
          maxOutputTokens: CONFIG.GEMINI_MAX_OUTPUT_TOKENS,
          temperature: CONFIG.GEMINI_TEMPERATURE
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini API Error:', response.status, err);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' && text.trim() ? text : null;
  } catch (error) {
    // Deno の fetch エラーは URL（= API キー）を含むため伏せて出力する
    console.error('Error generating AI response:', redactSecrets(error));
    return null;
  }
}

// AI が使えない・失敗したときの定型文。短時間に何度も同じ文を送らない。
async function pickManualFallbackReply(
  supabase: SupabaseClientType,
  storeId: string,
  userId: string,
): Promise<string | null> {
  const since = new Date(Date.now() - MANUAL_REPLY_FALLBACK_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('customer_logs')
    .select('id')
    .eq('store_id', storeId)
    .eq('line_user_id', userId)
    .eq('reply_content', MANUAL_REPLY_FALLBACK)
    .gte('created_at', since)
    .limit(1)
  return data && data.length > 0 ? null : MANUAL_REPLY_FALLBACK
}

Deno.serve(async (req: Request) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const signature = req.headers.get('x-line-signature')
    if (!signature) {
      return new Response('Bad Request: Missing Signature', { status: 400 })
    }

    const body = await req.text()

    // Parse body to get destination (Bot User ID)
    let jsonBody: { destination?: string; events?: LineEvent[] }
    try {
      jsonBody = JSON.parse(body)
    } catch {
      return new Response('Bad Request: Invalid JSON', { status: 400 })
    }
    const destination = jsonBody.destination
    const events = jsonBody.events || []

    console.log('Received event for destination:', destination)

    const okResponse = () =>
      new Response(JSON.stringify({ message: 'OK' }), { headers: { "Content-Type": "application/json" } })

    if (!destination) {
      if (events.length === 0) return okResponse()
      return new Response('Bad Request: Missing Destination', { status: 400 })
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? ''

    if (!supabaseServiceKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing')
        return new Response('Internal Server Error: Service Key missing', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 店舗の特定と署名検証は、応答を返す前に行う。
    // 非同期に回すと、未登録・署名不一致でも 200 を返してしまい、
    // LINE 側のエラー統計にも出ず、メッセージが無言で捨てられる。
    const { data: account, error: accountError } = await supabase
      .from('line_accounts')
      .select('channel_secret, channel_access_token, store_id')
      .eq('line_user_id', destination)
      .maybeSingle()

    if (accountError) {
      console.error('line_accounts lookup failed:', accountError.message)
      return new Response('Internal Server Error', { status: 500 })
    }

    // 「検証」ボタン（events が空）は、店舗を特定できた場合に限って署名まで確認する。
    // Channel Secret の貼り間違いを、ここで LINE 側に失敗として見せられる。
    // 店舗を特定できない場合は 200 のままにする（未接続の段階でも URL の疎通だけは確認できるように）。
    if (events.length === 0 && !account) return okResponse()

    if (!account?.channel_secret || !account.channel_access_token || !account.store_id) {
      console.error('Unknown destination or incomplete LINE settings:', destination)
      return new Response('Unauthorized', { status: 401 })
    }

    if (!(await verifySignature(account.channel_secret, body, signature))) {
      console.error('Invalid Signature')
      return new Response('Unauthorized', { status: 401 })
    }

    if (events.length === 0) return okResponse()

    const storeId: string = account.store_id
    const channelAccessToken: string = account.channel_access_token

    // Define the async processing task
    const processEvents = async () => {
      try {
        let isAiEnabled = false
        let aiSettings = null
        let plan = 'free' // Default to free

        console.log(`Checking plan for storeId: ${storeId}`)
        try {
          // Check Plan (Consistent with apply-rich-menu and other functions)
          const { data: storeData, error: storeError } = await supabase
            .from('stores')
            .select('owner_id')
            .eq('id', storeId)
            .single()

          if (storeError) {
            console.error('Error fetching store for plan check:', storeError)
          }

          if (storeData && storeData.owner_id) {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('plan')
              .eq('id', storeData.owner_id)
              .single()

            if (profileError) {
              console.error('Error fetching profile for plan check:', profileError)
            }

            if (profileData) {
              plan = String(profileData.plan || 'free').trim().toLowerCase()
            }
          }
        } catch (e) {
          console.error('Unexpected error during plan check:', e)
        }

        // Fetch AI Settings
        const { data: settings } = await supabase
          .from('ai_settings')
          .select('*')
          .eq('store_id', storeId)
          .maybeSingle()

        if (settings) {
          aiSettings = settings
          const planValid = isPaidPlan(plan)
          isAiEnabled = settings.is_enabled && planValid

          if (settings.is_enabled && !planValid) {
            console.log(`AI is enabled in settings but plan is ${plan}. Disabling AI.`)
          }
        }

        // 受信箱（customer_logs）に1件記録する
        const saveLog = async (
          userId: string,
          messageContent: string,
          status: string,
          replyText: string | null,
          replySent: boolean,
        ) => {
          const entry = buildLogEntry({ status, replyText, replySent })

          let displayName: string | null = null
          let pictureUrl = null
          const profile = await getProfile(channelAccessToken, userId)
          if (profile) {
            displayName = profile.displayName
            pictureUrl = profile.pictureUrl
          }

          let customer: { real_name?: string | null; display_name?: string | null } | null = null
          const { data: byLineUser } = await supabase
            .from('customers')
            .select('real_name, display_name')
            .eq('store_id', storeId)
            .eq('line_user_id', userId)
            .maybeSingle()
          customer = byLineUser
          if (!customer && displayName) {
            // 同名が複数いる場合 maybeSingle は null を返すので、別人には紐づかない
            const { data: byLineName } = await supabase
              .from('customers')
              .select('real_name, display_name')
              .eq('store_id', storeId)
              .eq('display_name', displayName)
              .maybeSingle()
            customer = byLineName
          }
          const logDisplayName =
            customer?.real_name?.trim() ||
            customer?.display_name?.trim() ||
            displayName

          const { error: insertError } = await supabase.from('customer_logs').insert({
            store_id: storeId,
            line_user_id: userId,
            display_name: logDisplayName,
            profile_picture_url: pictureUrl,
            message_content: messageContent,
            reply_content: entry.reply_content,
            status: entry.status,
          })
          if (insertError) {
            // ここで失敗すると店舗は問い合わせに気づけないので、必ず記録に残す
            console.error('Failed to save customer_logs:', insertError.message)
          }
        }

        // Process Events
        for (const event of events) {
          if (event.type !== 'message') continue

          const replyToken = event.replyToken
          const userId = event.source?.userId
          if (!userId) continue
          // グループ・ルームでの発言には反応しない
          if (event.source?.type === 'group' || event.source?.type === 'room') continue

          // 画像・動画などは返信せず、受信箱に残して店舗が気づけるようにする。
          // スタンプは返信不要のことが多く、要対応が増えるだけなので記録しない。
          if (event.message?.type !== 'text') {
            const messageType = event.message?.type
            if (messageType === 'sticker') continue
            await saveLog(userId, describeNonTextMessage(messageType), 'manual_reply_needed', null, false)
            continue
          }

          const text = event.message?.text
          // リッチメニューの空き枠は空白だけのテキストを送るため、無視する
          if (!replyToken || !text || isBlankText(text)) continue

          console.log(`Received message from user ${userId?.slice(0, 8)}...`)

          let replyText: string | null = null
          let status = 'manual_reply_needed'

          // 1. Get Auto Responses
          const { data: rules } = await supabase
            .from('auto_responses')
            .select('*')
            .eq('store_id', storeId)
            .eq('is_active', true)

          // 2-3. Scoring & Threshold（_shared/auto-response.ts）
          const autoMatch = selectAutoResponse(text, rules)
          const canUseAi = isAiEnabled && Boolean(geminiApiKey)
          const needsKeywordJudge = shouldDeferKeywordToAi(text, autoMatch, canUseAi)
          let useKeyword = Boolean(autoMatch) && !needsKeywordJudge

          if (needsKeywordJudge && autoMatch && geminiApiKey) {
            await startLoadingAnimation(channelAccessToken, userId)
            const responseText = typeof autoMatch.rule.response_text === 'string'
              ? autoMatch.rule.response_text
              : ''
            const verdict = await judgeKeywordReplyFit(geminiApiKey, {
              keyword: autoMatch.rule.keyword,
              responseText,
              userMessage: text,
            })
            if (verdict === 'keep') {
              useKeyword = true
              console.log(`Keyword '${autoMatch.rule.keyword}' judged KEEP`)
            } else {
              console.log(`Keyword '${autoMatch.rule.keyword}' judged AI (use full reply)`)
            }
          }

          if (useKeyword && autoMatch) {
            replyText = autoMatch.rule.response_text
            status = 'auto_replied'
            console.log('Selected auto-response rule:', autoMatch.rule.keyword)
          } else if (isAiEnabled && geminiApiKey) {
            // レート制限チェック（AI呼び出し前）
            const rateResult = await checkAiRateLimit(supabase, storeId, userId, text)
            if (!rateResult.allowed) {
              log.warn(`Rate limited: ${rateResult.reason} for user ${userId?.slice(0, 8)}...`)
              if (rateResult.reason === 'duplicate_message') {
                // 重複メッセージはサイレントスキップ（応答なし・ログなし）
                continue
              }
              replyText = CONFIG.RATE_LIMIT_FALLBACK
              status = 'manual_reply_needed'
            } else {
              console.log('Fallback to AI')
              await startLoadingAnimation(channelAccessToken, userId)

              const aiText = await generateAIResponse(geminiApiKey, text, aiSettings, storeId, supabase, userId)
              if (aiText === null) {
                // AI が失敗したときに、エラー文をお客様へ送らない。担当者対応に回す。
                replyText = await pickManualFallbackReply(supabase, storeId, userId)
                status = 'manual_reply_needed'
              } else {
                replyText = aiText
                status = 'ai_replied'

                if (replyText.includes('[MANUAL_REPLY_NEEDED]')) {
                  status = 'manual_reply_needed'
                  replyText = replyText.replace('[MANUAL_REPLY_NEEDED]', '').trim()
                }

                // AI応答成功を記録
                await recordAiUsage(supabase, storeId, userId, text)
              }
            }
          } else {
            replyText = await pickManualFallbackReply(supabase, storeId, userId)
            status = 'manual_reply_needed'
            console.log('Fallback to Manual Reply')
          }

          // 4. Send Reply
          let replySent = false
          if (replyText) {
            try {
              await replyMessage(channelAccessToken, replyToken, [{
                type: 'text',
                text: replyText
              }])
              replySent = true
            } catch (e) {
              console.error('Failed to send reply:', e)
            }
          }

          // 5. Save Log
          await saveLog(userId, text, status, replyText, replySent)
        }
      } catch (e) {
        console.error('processEvents failed:', redactSecrets(e))
      }

      // 古いレート制限レコードの確率的クリーンアップ（応答を遅らせないよう最後に行う）
      await maybeCleanupRateLimits(supabase)
    }

    // Execute async processing
    // @ts-ignore: EdgeRuntime is a Supabase Edge Function specific global
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore: EdgeRuntime.waitUntil is available in Supabase Edge Functions
        EdgeRuntime.waitUntil(processEvents())
    } else {
        await processEvents()
    }

    return okResponse()
  } catch (error: unknown) {
    const corsHeaders = getCorsHeaders(req.headers.get('Origin'))
    return safeErrorResponse(error, corsHeaders, 500, 'Webhook processing failed')
  }
})
