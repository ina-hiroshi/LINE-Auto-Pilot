import { describe, expect, it } from 'vitest'
import {
  buildDailyCounts,
  buildDailyUniqueUserCounts,
  buildStatusDistribution,
  buildTopNameCounts,
  buildTrailingDayKeys,
  buildWeekdayCounts,
} from './dashboardGraphs'

/** 2026-09-15（火） 12:00 ローカル時刻を「いま」とする */
const NOW = new Date(2026, 8, 15, 12, 0, 0)

describe('ダッシュボードのグラフ集計', () => {
  describe('buildTrailingDayKeys', () => {
    it('今日を含めて指定日数ぶんを古い順に返す', () => {
      const keys = buildTrailingDayKeys(NOW, 5)
      expect(keys).toEqual(['9/11', '9/12', '9/13', '9/14', '9/15'])
    })

    it('月をまたぐ場合も正しく計算する', () => {
      const keys = buildTrailingDayKeys(new Date(2026, 8, 2, 0, 0, 0), 4)
      expect(keys).toEqual(['8/30', '8/31', '9/1', '9/2'])
    })

    it('1日だけなら今日のキーのみ', () => {
      expect(buildTrailingDayKeys(NOW, 1)).toEqual(['9/15'])
    })
  })

  describe('buildDailyCounts', () => {
    it('日ごとの件数を数える', () => {
      const points = buildDailyCounts(NOW, 3, [
        new Date(2026, 8, 14, 9, 0).toISOString(),
        new Date(2026, 8, 14, 20, 0).toISOString(),
        new Date(2026, 8, 15, 0, 0).toISOString(),
      ])
      expect(points).toEqual([
        { date: '9/13', count: 0 },
        { date: '9/14', count: 2 },
        { date: '9/15', count: 1 },
      ])
    })

    it('集計範囲より前の日付は無視する', () => {
      const points = buildDailyCounts(NOW, 2, [new Date(2026, 8, 1, 0, 0).toISOString()])
      expect(points.every((p) => p.count === 0)).toBe(true)
    })

    it('データが無ければ全日 0 件で返す（穴を空けない）', () => {
      const points = buildDailyCounts(NOW, 7, [])
      expect(points).toHaveLength(7)
      expect(points.every((p) => p.count === 0)).toBe(true)
    })
  })

  describe('buildDailyUniqueUserCounts', () => {
    it('同日内の重複ユーザーは1件として数える', () => {
      const points = buildDailyUniqueUserCounts(NOW, 2, [
        { created_at: new Date(2026, 8, 15, 9, 0).toISOString(), line_user_id: 'U1' },
        { created_at: new Date(2026, 8, 15, 10, 0).toISOString(), line_user_id: 'U1' },
        { created_at: new Date(2026, 8, 15, 11, 0).toISOString(), line_user_id: 'U2' },
      ])
      expect(points).toEqual([
        { date: '9/14', count: 0 },
        { date: '9/15', count: 2 },
      ])
    })

    it('別の日の同じユーザーはそれぞれの日で数える', () => {
      const points = buildDailyUniqueUserCounts(NOW, 2, [
        { created_at: new Date(2026, 8, 14, 9, 0).toISOString(), line_user_id: 'U1' },
        { created_at: new Date(2026, 8, 15, 9, 0).toISOString(), line_user_id: 'U1' },
      ])
      expect(points).toEqual([
        { date: '9/14', count: 1 },
        { date: '9/15', count: 1 },
      ])
    })
  })

  describe('buildWeekdayCounts', () => {
    it('7曜日ぶんを日曜始まりで返す', () => {
      const points = buildWeekdayCounts([])
      expect(points.map((p) => p.day)).toEqual(['日', '月', '火', '水', '木', '金', '土'])
      expect(points.every((p) => p.count === 0)).toBe(true)
    })

    it('曜日ごとに件数を数える', () => {
      // 2026-09-15 は火曜日
      const points = buildWeekdayCounts([
        new Date(2026, 8, 15).toISOString(),
        new Date(2026, 8, 15).toISOString(),
        new Date(2026, 8, 13).toISOString(), // 日曜
      ])
      expect(points.find((p) => p.day === '火')?.count).toBe(2)
      expect(points.find((p) => p.day === '日')?.count).toBe(1)
      expect(points.find((p) => p.day === '月')?.count).toBe(0)
    })
  })

  describe('buildStatusDistribution', () => {
    it('既知のステータスを日本語ラベルに変換する', () => {
      const points = buildStatusDistribution(['auto_replied', 'ai_replied', 'auto_replied'])
      expect(points).toEqual([
        { name: '自動応答', value: 2, color: '#0d9488' },
        { name: 'AI応答', value: 1, color: '#2563eb' },
      ])
    })

    it('0件のステータスは出さない', () => {
      const points = buildStatusDistribution(['resolved'])
      expect(points).toEqual([{ name: '対応済', value: 1, color: '#94a3b8' }])
    })

    it('ラベルの並び順は固定（自動応答→AI応答→要対応→手動返信→対応済）', () => {
      const points = buildStatusDistribution([
        'resolved', 'manual_replied', 'manual_reply_needed', 'ai_replied', 'auto_replied',
      ])
      expect(points.map((p) => p.name)).toEqual(['自動応答', 'AI応答', '要対応', '手動返信', '対応済'])
    })

    it('未知のステータスは無視する', () => {
      const points = buildStatusDistribution(['unknown_status'])
      expect(points).toEqual([])
    })
  })

  describe('buildTopNameCounts', () => {
    const names = new Map([
      ['m1', 'カット'],
      ['m2', 'カラー'],
    ])

    it('件数の多い順に並べる', () => {
      const points = buildTopNameCounts(['m1', 'm2', 'm1', 'm1'], names)
      expect(points).toEqual([
        { name: 'カット', count: 3 },
        { name: 'カラー', count: 1 },
      ])
    })

    it('名前が引けないIDは「未設定」にまとめる', () => {
      const points = buildTopNameCounts(['m1', 'deleted-menu', 'deleted-menu'], names)
      expect(points).toEqual([
        { name: '未設定', count: 2 },
        { name: 'カット', count: 1 },
      ])
    })

    it('null/undefined/空文字のIDは数えない', () => {
      const points = buildTopNameCounts(['m1', null, undefined, ''], names)
      expect(points).toEqual([{ name: 'カット', count: 1 }])
    })

    it('上限件数で切る', () => {
      const manyNames = new Map(Array.from({ length: 15 }, (_, i) => [`id${i}`, `名前${i}`]))
      const ids = Array.from({ length: 15 }, (_, i) => `id${i}`)
      const points = buildTopNameCounts(ids, manyNames, 10)
      expect(points).toHaveLength(10)
    })

    it('データが無ければ空配列', () => {
      expect(buildTopNameCounts([], names)).toEqual([])
    })
  })
})
