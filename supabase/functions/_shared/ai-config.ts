/**
 * 既定モデル。
 *
 * gemini-2.0-flash は 2026-06-01 に提供終了し、以降 generateContent が
 * エラーを返すため AI 応答・AIレポートが全店舗で停止していた。
 *
 * 後継のうち実際に呼び出せるものでは 3.1 Flash-Lite が最安
 * （$0.25 / 1M 入力、$1.50 / 1M 出力）。自動応答は 1 通ごとに
 * 学習データ 8,000 文字を入力へ載せる高頻度・低難度の用途なので、
 * 同世代でより高価な Flash 系を使う理由がない。
 *
 * 単価だけなら 2.5 Flash-Lite（$0.10 / $0.40）が下だが、Google が
 * 2.5 系を「過去に利用実績のあるプロジェクト」に限定しており、
 * このプロジェクトの API キーでは呼び出せないことを確認済み。
 *
 * 品質を上げたい場合は Supabase Secret の GEMINI_MODEL で上書きする。
 */
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite'

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
