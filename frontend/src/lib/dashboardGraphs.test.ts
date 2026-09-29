import { describe, expect, it } from 'vitest'
import {
  buildDailyCounts,
  buildDailyUniqueUserCounts,
  buildStatusDistribution,
  buildTrendCounts,
  buildTrendUniqueUserCounts,
  buildTrendWindow,
  findPeakWeekdays,
  summarizeTrend,
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
        { name: '自動応答', value: 2, color: '#2a78d6' },
        { name: 'AI応答', value: 1, color: '#4a3aa7' },
      ])
    })

    it('0件のステータスは出さない', () => {
      const points = buildStatusDistribution(['resolved'])
      expect(points).toEqual([{ name: '対応済', value: 1, color: '#a8b0bc' }])
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
  describe('推移グラフの横軸（選択期間に連動）', () => {
    it('今日: 0〜23時の24バケットで、時間帯別に数える', () => {
      const w = buildTrendWindow('today', NOW)
      expect(w.granularity).toBe('hour')
      expect(w.buckets).toHaveLength(24)
      const points = buildTrendCounts(w, NOW, [
        new Date(2026, 8, 15, 9, 10).toISOString(),
        new Date(2026, 8, 15, 9, 50).toISOString(),
        new Date(2026, 8, 14, 9, 0).toISOString(), // 昨日は数えない
      ], true)
      expect(points[9].count).toBe(2)
      expect(points[8].count).toBe(0)
    })

    it('今日: まだ来ていない時間帯は null（0件と区別する）', () => {
      const points = buildTrendCounts(buildTrendWindow('today', NOW), NOW, [], true)
      expect(points[12].count).toBe(0) // NOW は12:00 ちょうど＝今の時間帯
      expect(points[13].count).toBeNull()
    })

    it('今週: 日曜〜土曜の7日。未来の日は null、予約のように未来も描くなら 0', () => {
      const w = buildTrendWindow('week', NOW) // 2026-09-15(火)
      expect(w.buckets.map((b) => b.label)).toEqual(['9/13', '9/14', '9/15', '9/16', '9/17', '9/18', '9/19'])
      const past = buildTrendCounts(w, NOW, [], true)
      expect(past.map((p) => p.count)).toEqual([0, 0, 0, null, null, null, null])
      const withFuture = buildTrendCounts(w, NOW, [new Date(2026, 8, 17, 10).toISOString()], false)
      expect(withFuture.map((p) => p.count)).toEqual([0, 0, 0, 0, 1, 0, 0])
    })

    it('今月: 月の日数ぶん（9月は30日）', () => {
      const w = buildTrendWindow('month', NOW)
      expect(w.buckets).toHaveLength(30)
      expect(w.buckets[0].label).toBe('9/1')
      expect(w.buckets[29].label).toBe('9/30')
      expect(w.description).toBe('今月（9月）')
    })

    it('全期間: 今日までの直近30日', () => {
      const w = buildTrendWindow('all', NOW)
      expect(w.buckets).toHaveLength(30)
      expect(w.buckets[29].label).toBe('9/15')
      expect(w.buckets[0].label).toBe('8/17')
    })

    it('年をまたぐ全期間でも別の日として数える', () => {
      const jan = new Date(2027, 0, 5, 12)
      const w = buildTrendWindow('all', jan)
      const keys = new Set(w.buckets.map((b) => b.key))
      expect(keys.size).toBe(30)
      const points = buildTrendCounts(w, jan, [new Date(2026, 11, 31, 10).toISOString()], true)
      expect(points.find((p) => p.label === '12/31')?.count).toBe(1)
    })

    it('ユニークユーザーは同じバケット内の重複を1人として数える', () => {
      const w = buildTrendWindow('week', NOW)
      const points = buildTrendUniqueUserCounts(w, NOW, [
        { created_at: new Date(2026, 8, 15, 9).toISOString(), line_user_id: 'U1' },
        { created_at: new Date(2026, 8, 15, 10).toISOString(), line_user_id: 'U1' },
        { created_at: new Date(2026, 8, 15, 11).toISOString(), line_user_id: 'U2' },
      ])
      expect(points.map((p) => p.count)).toEqual([0, 0, 2, null, null, null, null])
    })
  })

  describe('summarizeTrend', () => {
    it('合計・平均・ピークを返し、null（未来）は平均の母数に入れない', () => {
      const s = summarizeTrend([
        { key: 'a', label: '9/13', fullLabel: '9月13日(日)', count: 2 },
        { key: 'b', label: '9/14', fullLabel: '9月14日(月)', count: 5 },
        { key: 'c', label: '9/15', fullLabel: '9月15日(火)', count: 0 },
        { key: 'd', label: '9/16', fullLabel: '9月16日(水)', count: null },
      ])
      expect(s.total).toBe(7)
      expect(s.average).toBe(2.3)
      expect(s.peak).toEqual({ label: '9/14', fullLabel: '9月14日(月)', count: 5 })
    })

    it('全部0件ならピークなし', () => {
      const s = summarizeTrend([{ key: 'a', label: '9/13', fullLabel: '', count: 0 }])
      expect(s).toEqual({ total: 0, average: 0, peak: null })
    })

    it('空配列でも壊れない', () => {
      expect(summarizeTrend([])).toEqual({ total: 0, average: 0, peak: null })
    })
  })

  describe('findPeakWeekdays', () => {
    it('最多の曜日を返し、同数なら複数返す', () => {
      expect(findPeakWeekdays([
        { day: '日', count: 1 }, { day: '月', count: 4 }, { day: '火', count: 4 },
      ])).toEqual(['月', '火'])
    })

    it('全部0件なら空（強調しない）', () => {
      expect(findPeakWeekdays([{ day: '日', count: 0 }])).toEqual([])
    })
  })
})
