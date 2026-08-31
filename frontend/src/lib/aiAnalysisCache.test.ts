import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AI_ANALYSIS_TTL_MS,
  aiAnalysisStorageKey,
  loadAIAnalysisCache,
  saveAIAnalysisCache,
  type AIAnalysisPayload,
} from './aiAnalysisCache'

const STORE_ID = 'store-1'
const NOW = 1_800_000_000_000

const payload = (over: Partial<AIAnalysisPayload> = {}): AIAnalysisPayload => ({
  summary: '直近30日で問い合わせが増えています',
  insights: ['営業時間の質問が多い'],
  improvements: ['営業時間の自動応答を追加する'],
  reservationAnalysis: '週末に予約が集中しています',
  questionCategories: [{ category: '営業時間', count: 12, examples: ['何時まで？'] }],
  topCustomersByMessages: [{ name: '山田 太郎', count: 8 }],
  topCustomersByReservations: [{ name: '鈴木 花子', count: 4 }],
  popularMenus: [{ name: 'カット', count: 20 }],
  staffStats: [{ name: '田中', count: 15 }],
  ...over,
})

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('aiAnalysisStorageKey', () => {
  it('店舗ごとに別のキーを使う', () => {
    expect(aiAnalysisStorageKey('a')).toBe('ai-analysis-a')
    expect(aiAnalysisStorageKey('a')).not.toBe(aiAnalysisStorageKey('b'))
  })
})

describe('saveAIAnalysisCache / loadAIAnalysisCache', () => {
  it('保存したレポートを読み戻せる', () => {
    const data = payload()
    saveAIAnalysisCache(STORE_ID, data, NOW)

    expect(loadAIAnalysisCache(STORE_ID, NOW)).toEqual(data)
  })

  it('未保存なら null', () => {
    expect(loadAIAnalysisCache(STORE_ID, NOW)).toBeNull()
  })

  it('他店舗のキャッシュを読まない', () => {
    saveAIAnalysisCache(STORE_ID, payload({ summary: '自店舗' }), NOW)

    expect(loadAIAnalysisCache('store-2', NOW)).toBeNull()
  })

  it('storeId が無ければ読み書きしない', () => {
    saveAIAnalysisCache(null, payload(), NOW)
    expect(localStorage.length).toBe(0)
    expect(loadAIAnalysisCache(null, NOW)).toBeNull()
    expect(loadAIAnalysisCache(undefined, NOW)).toBeNull()
  })

  describe('有効期限', () => {
    it('24時間の直前までは有効', () => {
      saveAIAnalysisCache(STORE_ID, payload(), NOW)

      const justBefore = NOW + AI_ANALYSIS_TTL_MS - 1
      expect(loadAIAnalysisCache(STORE_ID, justBefore)).not.toBeNull()
    })

    it('24時間ちょうどで期限切れにする', () => {
      saveAIAnalysisCache(STORE_ID, payload(), NOW)

      expect(loadAIAnalysisCache(STORE_ID, NOW + AI_ANALYSIS_TTL_MS)).toBeNull()
    })

    it('期限切れのデータは読み捨てずに削除する', () => {
      saveAIAnalysisCache(STORE_ID, payload(), NOW)
      loadAIAnalysisCache(STORE_ID, NOW + AI_ANALYSIS_TTL_MS + 1)

      expect(localStorage.getItem(aiAnalysisStorageKey(STORE_ID))).toBeNull()
    })
  })

  describe('壊れたデータ', () => {
    it('JSONとして壊れていても例外を投げない', () => {
      localStorage.setItem(aiAnalysisStorageKey(STORE_ID), '{壊れた')
      vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(loadAIAnalysisCache(STORE_ID, NOW)).toBeNull()
    })

    it('timestamp が無いデータは破棄する', () => {
      localStorage.setItem(
        aiAnalysisStorageKey(STORE_ID),
        JSON.stringify({ data: payload() }),
      )

      expect(loadAIAnalysisCache(STORE_ID, NOW)).toBeNull()
      expect(localStorage.getItem(aiAnalysisStorageKey(STORE_ID))).toBeNull()
    })

    it('timestamp が数値でないデータも破棄する', () => {
      localStorage.setItem(
        aiAnalysisStorageKey(STORE_ID),
        JSON.stringify({ timestamp: 'きのう', data: payload() }),
      )

      expect(loadAIAnalysisCache(STORE_ID, NOW)).toBeNull()
    })
  })

  describe('localStorage が使えない環境', () => {
    it('読み込みが失敗してもレポート表示を止めない', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(loadAIAnalysisCache(STORE_ID, NOW)).toBeNull()
    })

    it('保存が失敗しても例外を投げない（容量超過など）', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => saveAIAnalysisCache(STORE_ID, payload(), NOW)).not.toThrow()
    })
  })

  it('ログアウト時の localStorage.clear() でキャッシュも消える', () => {
    // 共有端末で顧客分析が残らないことを担保する（Layout のログアウト処理）
    saveAIAnalysisCache(STORE_ID, payload(), NOW)
    expect(loadAIAnalysisCache(STORE_ID, NOW)).not.toBeNull()

    localStorage.clear()

    expect(loadAIAnalysisCache(STORE_ID, NOW)).toBeNull()
  })
})
