// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'

// ============ 定数定義 ============
const CONFIG = {
  /** LINE ローディングアニメーションの表示秒数 */
  LOADING_ANIMATION_SECONDS: 20,
  /** AI学習データの最大文字数 */
  KNOWLEDGE_BASE_MAX_CHARS: 30000,
  /** Gemini API の最大出力トークン数 */
  GEMINI_MAX_OUTPUT_TOKENS: 500,
  /** Gemini API の温度パラメータ */
  GEMINI_TEMPERATURE: 0.4,
  /** 自動応答スコアリング */
  SCORING: {
    /** キーワード完全一致時のスコア */
    EXACT_MATCH: 100,
    /** キーワード部分一致時のスコア */
    PARTIAL_MATCH: 30,
    /** サブキーワード一致時のスコア */
    SUB_KEYWORD_MATCH: 10,
    /** 自動応答を発動するしきい値 */
    THRESHOLD: 25,
  },
} as const;

type LineTextMessage = { type: 'text'; text: string }
type LineMessage = LineTextMessage
type LineEvent = {
  type: string
  message?: { type: string; text?: string }
  replyToken?: string
  source?: { userId?: string }
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

// Helper to normalize text for keyword matching
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[？！。、]/g, '');
}

// Helper to generate AI response using Gemini API
import type { SupabaseClientType, AISettings } from '../_shared/types.ts'
import { generateSystemPrompt } from '../_shared/ai-prompt.ts'

async function generateAIResponse(
  apiKey: string,
  message: string,
  settings: AISettings,
  storeId: string,
  supabase: SupabaseClientType,
  userId?: string
): Promise<string> {
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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const contents = [
      ...conversationHistory,
      { role: 'user' as const, parts: [{ text: message }] }
    ];
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      console.error('Gemini API Error:', err);
      return "申し訳ありません。現在AI応答を利用できません。";
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "応答を生成できませんでした。";
  } catch (error) {
    console.error('Error generating AI response:', error);
    return "エラーが発生しました。";
  }
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
    const jsonBody = JSON.parse(body) as { destination?: string; events?: LineEvent[] }
    const destination = jsonBody.destination
    const events = jsonBody.events || []

    console.log('Received event for destination:', destination)

    if (!destination) {
       if (events.length === 0) {
          return new Response(JSON.stringify({ message: 'OK' }), { headers: { "Content-Type": "application/json" } })
       }
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

    // Define the async processing task
    const processEvents = async () => {
        let channelSecret = Deno.env.get('LINE_CHANNEL_SECRET')
        let channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')

        // Try DB lookup if destination exists
        let storeId = null
        let isAiEnabled = false
        let aiSettings = null
        let plan = 'free' // Default to free

        if (destination) {
            const { data } = await supabase
                .from('line_accounts')
                .select(`
                    channel_secret, 
                    channel_access_token,
                    store_id
                `)
                .eq('line_user_id', destination)
                .maybeSingle()
            
            if (data) {
                channelSecret = data.channel_secret
                channelAccessToken = data.channel_access_token
                storeId = data.store_id
                
                if (storeId) {
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
                                console.log(`Plan detected: ${plan}`)
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
                        // Only enable AI if plan is pro/executive AND settings is enabled
                        const isPlanValid = (plan === 'pro' || plan === 'executive')
                        isAiEnabled = settings.is_enabled && isPlanValid

                        if (settings.is_enabled && !isPlanValid) {
                            console.log(`AI is enabled in settings but plan is ${plan}. Disabling AI.`)
                        }
                    }
                }
            }
        }

        if (!channelSecret || !channelAccessToken) {
            console.error('Missing Channel Secret or Access Token')
            return
        }

        // Verify Signature
        const isValid = await verifySignature(channelSecret, body, signature)
        if (!isValid) {
            console.error('Invalid Signature')
            return
        }

        // Process Events
        for (const event of events) {
            if (event.type === 'message' && event.message?.type === 'text') {
                const replyToken = event.replyToken
                const text = event.message?.text
                const userId = event.source?.userId

                if (!replyToken || !text || !userId) continue
                
                console.log(`Received message: ${text} from ${userId}`)

                let replyText = null
                let status = 'manual_reply_needed'

                if (storeId) {
                    // 1. Get Auto Responses
                    const { data: rules } = await supabase
                        .from('auto_responses')
                        .select('*')
                        .eq('store_id', storeId)
                        .eq('is_active', true)
                    
                    // 2. Scoring Logic (improved with normalization and length weighting)
                    let bestScore = 0
                    let bestRule = null
                    let bestKeywordLength = 0

                    if (rules && rules.length > 0) {
                        const normalizedText = normalizeText(text);
                        
                        for (const rule of rules) {
                            let score = 0
                            const normalizedKeyword = normalizeText(rule.keyword);
                            
                            // Exact match check
                            if (normalizedText === normalizedKeyword) {
                                score = CONFIG.SCORING.EXACT_MATCH
                            } else if (normalizedText.includes(normalizedKeyword)) {
                                // Partial match with length bonus
                                const lengthBonus = Math.min(rule.keyword.length * 2, 20);
                                score += CONFIG.SCORING.PARTIAL_MATCH + lengthBonus;
                            }

                            // Sub-keyword matching
                            if (rule.sub_keywords && Array.isArray(rule.sub_keywords)) {
                                for (const sub of rule.sub_keywords) {
                                    const normalizedSub = normalizeText(sub);
                                    if (normalizedText.includes(normalizedSub)) {
                                        score += CONFIG.SCORING.SUB_KEYWORD_MATCH
                                    }
                                }
                            }
                            
                            // Select best rule (higher score, or same score but longer keyword)
                            if (score > bestScore || (score === bestScore && rule.keyword.length > bestKeywordLength)) {
                                bestScore = score
                                bestRule = rule
                                bestKeywordLength = rule.keyword.length
                            }
                        }
                    }
                    
                    // 3. Threshold Check
                    if (bestScore >= CONFIG.SCORING.THRESHOLD && bestRule) {
                        replyText = bestRule.response_text
                        status = 'auto_replied'
                        console.log('Selected auto-response rule:', bestRule.keyword)
                    } else {
                        // Fallback
                        if (isAiEnabled && geminiApiKey) {
                            console.log('Fallback to AI')
                            // Start loading animation
                            await startLoadingAnimation(channelAccessToken, userId)
                            
                            replyText = await generateAIResponse(geminiApiKey, text, aiSettings, storeId, supabase, userId)
                            status = 'ai_replied'

                            // Check for manual reply needed tag
                            if (replyText.includes('[MANUAL_REPLY_NEEDED]')) {
                                status = 'manual_reply_needed'
                                replyText = replyText.replace('[MANUAL_REPLY_NEEDED]', '').trim()
                            }
                        } else {
                            // Manual Reply Needed
                            // Fallback to fixed message when AI is disabled or not applicable
                            replyText = "お問い合わせありがとうございます。\n担当者が確認次第、返信させていただきます。\n今しばらくお待ちください。"
                            status = 'manual_reply_needed'
                            console.log('Fallback to Manual Reply (Fixed Message Sent)')
                        }
                    }

                    // 4. Send Reply
                    if (replyText) {
                        try {
                            await replyMessage(channelAccessToken, replyToken, [{
                                type: 'text',
                                text: replyText
                            }])
                        } catch (e) {
                            console.error('Failed to send reply:', e)
                        }
                    }

                    // 5. Save Log
                    let displayName = null
                    let pictureUrl = null
                    if (channelAccessToken) {
                        const profile = await getProfile(channelAccessToken, userId)
                        if (profile) {
                            displayName = profile.displayName
                            pictureUrl = profile.pictureUrl
                        }
                    }

                    await supabase.from('customer_logs').insert({
                        store_id: storeId,
                        line_user_id: userId,
                        display_name: displayName,
                        profile_picture_url: pictureUrl,
                        message_content: text,
                        reply_content: replyText,
                        status: status
                    })
                }
            }
        }
    }

    // Execute async processing
    // @ts-ignore: EdgeRuntime is a Supabase Edge Function specific global
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore: EdgeRuntime.waitUntil is available in Supabase Edge Functions
        EdgeRuntime.waitUntil(processEvents())
    } else {
        await processEvents()
    }

    return new Response(
      JSON.stringify({ message: 'OK' }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error: unknown) {
    console.error('Error processing request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})
