import { getGeminiUrl, KNOWLEDGE_BASE_MAX_CHARS } from './ai-config.ts'
import type { SupabaseClientType, AISettings } from './types.ts'
import { generateSystemPrompt } from './ai-prompt.ts'

export async function generateAIResponse(apiKey: string, message: string, settings: AISettings, storeId: string, supabase: SupabaseClientType, throwOnFailure = false): Promise<string> {
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
      context = docs.map((d: { extracted_text?: string }) => d.extracted_text || "").join("\n\n").substring(0, KNOWLEDGE_BASE_MAX_CHARS);
    }

    // 2. Generate System Prompt using shared function
    const systemPrompt = generateSystemPrompt(settings, context);

    // 3. Call Gemini API with optimized format
    const url = getGeminiUrl(apiKey);
    
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
      if (throwOnFailure) throw new Error("AI unavailable");
      return "申し訳ありません。現在AI応答を利用できません。";
    }

    const data = await response.json();
    if (throwOnFailure && !data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error("Empty AI reply");
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "応答を生成できませんでした。";
    
    // Strip the tag for preview
    reply = reply.replace('[MANUAL_REPLY_NEEDED]', '').trim();
    
    return reply;
  } catch (error) {
    console.error('Error generating AI response:', error);
    if (throwOnFailure) throw error;
    return "エラーが発生しました。";
  }
}

