import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to generate AI response using Gemini API (Duplicated from line-webhook for now)
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

【重要：エスカレーション判断】
もし、ユーザーの質問に対してAI学習データの情報だけでは回答できない場合、または「担当者に確認します」といった対応が必要な場合は、
回答の最後に必ず [MANUAL_REPLY_NEEDED] というタグをつけてください。

【重要：フォーマット】
LINEのメッセージとして返信するため、Markdown記法（**太字**、# 見出し、- リストなど）は使用しないでください。
プレーンテキストのみで読みやすく整形してください。
箇条書きをする場合は、記号（・や数字）を使って手動で整形してください。

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
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "応答を生成できませんでした。";
    
    // Strip the tag for preview
    reply = reply.replace('[MANUAL_REPLY_NEEDED]', '').trim();
    
    return reply;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return "エラーが発生しました。";
  }
}

serve(async (req) => {
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { message, store_id, ai_settings } = await req.json()

    if (!message) {
      throw new Error('Message is required')
    }

    const reply = await generateAIResponse(geminiApiKey, message, ai_settings, store_id, supabase)

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Preview Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
