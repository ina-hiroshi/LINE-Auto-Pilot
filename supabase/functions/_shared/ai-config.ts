const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'

/**
 * ナレッジベースをプロンプトに埋め込む際の最大文字数。
 * 毎メッセージ入力トークンとして課金されるため、ここが AI 応答コストをほぼ決める。
 * line-webhook / ai-chat-preview で値がずれると本番とプレビューの回答が食い違うので、
 * 必ずこの定数を参照すること。
 * frontend/src/pages/AutoResponses.tsx の同名定数とも揃える。
 */
export const KNOWLEDGE_BASE_MAX_CHARS = 8000

export function getGeminiUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
}
