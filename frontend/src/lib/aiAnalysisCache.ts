/**
 * AIレポートのブラウザキャッシュ。
 *
 * dashboard-ai-analysis は Gemini を呼ぶため遅く、課金も伴う。
 * タブを開き直すたびに再生成しないよう、店舗ごとに24時間だけ保持する。
 * ログアウト時は Layout の localStorage.clear() でまとめて消える。
 */

export type AIAnalysisPayload = {
  summary: string
  insights: string[]
  improvements: string[]
  reservationAnalysis: string
  questionCategories: { category: string; count: number; examples: string[] }[]
  topCustomersByMessages: { name: string; count: number }[]
  topCustomersByReservations: { name: string; count: number }[]
  popularMenus: { name: string; count: number }[]
  staffStats: { name: string; count: number }[]
}

export const AI_ANALYSIS_TTL_MS = 24 * 60 * 60 * 1000

export function aiAnalysisStorageKey(storeId: string): string {
  return `ai-analysis-${storeId}`
}

/**
 * 保存済みのレポートを返す。期限切れ・壊れたデータは破棄して null を返す。
 * localStorage が使えない環境（プライベートモード等）でも例外を投げない。
 */
export function loadAIAnalysisCache(
  storeId: string | null | undefined,
  now: number = Date.now(),
): AIAnalysisPayload | null {
  if (!storeId) return null

  const key = aiAnalysisStorageKey(storeId)
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const parsed = JSON.parse(stored) as { timestamp?: number; data?: AIAnalysisPayload }

    if (typeof parsed?.timestamp === 'number' && now - parsed.timestamp < AI_ANALYSIS_TTL_MS) {
      return parsed.data ?? null
    }

    // 期限切れ・timestamp 欠落は残さない
    localStorage.removeItem(key)
    return null
  } catch (error) {
    console.error('Error loading AI analysis from storage:', error)
    return null
  }
}

export function saveAIAnalysisCache(
  storeId: string | null | undefined,
  data: AIAnalysisPayload,
  now: number = Date.now(),
): void {
  if (!storeId) return

  try {
    localStorage.setItem(aiAnalysisStorageKey(storeId), JSON.stringify({ timestamp: now, data }))
  } catch (error) {
    // 容量超過などで保存できなくても、レポート自体の表示は続行する
    console.error('Error saving AI analysis to storage:', error)
  }
}
