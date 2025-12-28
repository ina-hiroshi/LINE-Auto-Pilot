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
以下の「店舗情報（ナレッジベース）」に基づいて、ユーザーの質問に答えてください。
ナレッジベースに情報がない場合は、正直に「わかりません」と答えるか、店舗への問い合わせを促してください。
嘘の情報は絶対に答えないでください。

口調: ${settings.tone === 'friendly' ? 'フレンドリー、親しみやすい' : '丁寧、フォーマル'}
`;

    if (settings.persona_prompt) {
      systemPrompt += `\n追加の役割指示: ${settings.persona_prompt}`;
    }

    if (context) {
      systemPrompt += `\n\n[店舗情報（ナレッジベース）]\n${context}`;
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
