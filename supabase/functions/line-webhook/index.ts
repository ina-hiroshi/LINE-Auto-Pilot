import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
        loadingSeconds: 20 // Display for up to 20 seconds
      })
    })
  } catch (e) {
    console.error('Error starting loading animation:', e)
    // Do not throw error to continue processing
  }
}

// Helper to generate AI response using Gemini API
async function generateAIResponse(apiKey: string, message: string, settings: any, storeId: string, supabase: any): Promise<string> {
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
      context = docs.map((d: any) => d.extracted_text || "").join("\n\n").substring(0, 30000);
    }

    // 2. Construct System Prompt
    let systemPrompt = `あなたはLINE公式アカウントのAIアシスタントです。
以下の「店舗情報（AI学習データ）」に基づいて、ユーザーの質問に答えてください。
AI学習データに情報がない場合は、正直に「わかりません」と答えるか、店舗への問い合わせを促してください。
嘘の情報は絶対に答えないでください。

【重要：回答不可時の対応】
情報が不足していて回答できない場合は、「AI学習データ」「ナレッジベース」「データベース」「システム」といった内部用語は使わず、
「申し訳ありませんが、その件については担当者が確認して返信いたします。少々お待ちください。」のように、
担当者からの手動返信を待つよう促すメッセージを返してください。

【重要：エスカレーション（要対応）の判断基準】
回答の最後に [MANUAL_REPLY_NEEDED] タグをつけるのは、以下の「回答不能」なケース**のみ**です。

1. AI学習データに情報がなく、質問に答えられない場合。
2. 「担当者に確認します」「スタッフが対応します」といった、人間の介入を約束する場合。

以下のケースでは、タグを**絶対に付けないでください**（AI回答済みとして処理します）：
1. 「その機能はありません」「できません」といった、否定的な回答をする場合。
2. 「〜については、〜をご覧ください」と案内する場合。
3. ユーザーの要望を断る場合。
4. 「ご不明な点があればお問い合わせください」といった、一般的な結びの言葉がある場合。
これらは「回答できた」とみなされます。

【判断の具体例】
ケース1: ユーザー「予約ページの背景を変えたい」
AI回答: 「申し訳ありませんが、予約ページのデザイン変更機能はありません。」
判定: 回答できている（否定回答） -> タグ不要

ケース2: ユーザー「来週の火曜日に貸切できますか？」
AI回答: 「貸切については担当者が確認してご連絡します。少々お待ちください。[MANUAL_REPLY_NEEDED]」
判定: 人間の介入が必要 -> タグ必要

ケース3: ユーザー「駐車場はありますか？」
AI回答: 「はい、店舗裏に3台分ございます。ご不明な点はお問い合わせください。」
判定: 回答できている（結びの言葉） -> タグ不要

【重要：フォーマット（絶対遵守）】
LINEのメッセージはMarkdownをサポートしていません。
以下の記法は**絶対に使用しないでください**：
- **太字** (アスタリスク2つ)
- # 見出し (シャープ)
- [リンクテキスト](URL) (リンク記法)

代わりに以下のようにプレーンテキストで表現してください：
- 太字の代わりに、隅付き括弧【 】や「 」を使う。
- 見出しの代わりに、■や◆などの記号を使う。
- リストは「・」や数字を使って手動で改行する。

悪い例: **スタッフ登録**
良い例: 【スタッフ登録】

口調: ${settings.tone === 'friendly' ? 'フレンドリー、親しみやすい' : '丁寧、フォーマル'}
`;

    if (settings.persona_prompt) {
      systemPrompt += `\n追加の役割指示: ${settings.persona_prompt}`;
    }

    if (context) {
      systemPrompt += `\n\n[店舗情報（AI学習データ）]\n${context}`;
    }

    // 3. Call Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: systemPrompt + "\n\nユーザーのメッセージ: " + message }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7
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

serve(async (req: Request) => {
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
        let account = null
        let storeId = null
        let isAiEnabled = false
        let aiSettings = null
        let plan = 'free' // Default to free

        if (destination) {
            const { data, error } = await supabase
                .from('line_accounts')
                .select(`
                    channel_secret, 
                    channel_access_token,
                    store_id
                `)
                .eq('line_user_id', destination)
                .maybeSingle()
            
            if (data) {
                account = data
                channelSecret = data.channel_secret
                channelAccessToken = data.channel_access_token
                storeId = data.store_id
                
                if (storeId) {
                    // Check Plan (Store -> Owner -> Profile)
                    const { data: storeData } = await supabase
                        .from('stores')
                        .select('owner_id')
                        .eq('id', storeId)
                        .single()
                    
                    if (storeData && storeData.owner_id) {
                        const { data: profileData } = await supabase
                            .from('profiles')
                            .select('plan')
                            .eq('id', storeData.owner_id)
                            .single()
                        
                        if (profileData) {
                            plan = profileData.plan || 'free'
                        }
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
                    
                    // 2. Scoring Logic
                    let bestScore = 0
                    let bestRule = null

                    if (rules && rules.length > 0) {
                        for (const rule of rules) {
                            let score = 0
                            if (text === rule.keyword) score = 100
                            else if (text.includes(rule.keyword)) score += 30

                            if (rule.sub_keywords && Array.isArray(rule.sub_keywords)) {
                                for (const sub of rule.sub_keywords) {
                                    if (text.includes(sub)) score += 10
                                }
                            }
                            if (score > bestScore) {
                                bestScore = score
                                bestRule = rule
                            }
                        }
                    }
                    
                    // 3. Threshold Check (Threshold: 20)
                    if (bestScore >= 20 && bestRule) {
                        replyText = bestRule.response_text
                        status = 'auto_replied'
                        console.log('Selected auto-response rule:', bestRule.keyword)
                    } else {
                        // Fallback
                        if (isAiEnabled && geminiApiKey) {
                            console.log('Fallback to AI')
                            // Start loading animation
                            await startLoadingAnimation(channelAccessToken, userId)
                            
                            replyText = await generateAIResponse(geminiApiKey, text, aiSettings, storeId, supabase)
                            status = 'ai_replied'

                            // Check for manual reply needed tag
                            if (replyText.includes('[MANUAL_REPLY_NEEDED]')) {
                                status = 'manual_reply_needed'
                                replyText = replyText.replace('[MANUAL_REPLY_NEEDED]', '').trim()
                            }
                        } else {
                            // Manual Reply Needed
                            // AIが無効の場合は自動応答を送信しない（手動対応待ちステータスのみ記録）
                            replyText = null
                            status = 'manual_reply_needed'
                            console.log('Fallback to Manual Reply (No response sent)')
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
    // @ts-ignore
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
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
