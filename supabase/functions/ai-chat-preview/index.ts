// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to generate AI response using Gemini API
import type { SupabaseClientType, AISettings } from '../_shared/types.ts'
import { generateSystemPrompt } from '../_shared/ai-prompt.ts'

async function generateAIResponse(apiKey: string, message: string, settings: AISettings, storeId: string, supabase: SupabaseClientType): Promise<string> {
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
      context = docs.map((d: { extracted_text?: string }) => d.extracted_text || "").join("\n\n").substring(0, 30000);
    }

    // 2. Generate System Prompt using shared function
    const systemPrompt = generateSystemPrompt(settings, context);

    // 3. Call Gemini API with optimized format
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          { role: "user", parts: [{ text: message }] }
        ],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.4
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

Deno.serve(async (req: Request) => {
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
  } catch (error: unknown) {
    console.error('Preview Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
