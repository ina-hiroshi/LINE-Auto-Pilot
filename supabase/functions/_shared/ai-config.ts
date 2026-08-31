/**
 * 既定モデル。
 * gemini-2.0-flash は 2026-06-01 に提供終了し、以降 generateContent が
 * エラーを返すため AI 応答・AIレポートが全店舗で停止していた。
 * Google が案内する 2.0 Flash の移行先である 3.5 Flash を既定にする。
 * 一時的に別モデルへ切り替えたいときは Supabase Secret の GEMINI_MODEL で上書きする。
 */
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash'

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
