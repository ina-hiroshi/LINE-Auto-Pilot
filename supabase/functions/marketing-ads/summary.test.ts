import { assertEquals, assertAlmostEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { buildAdsSummary, type RawAdInsightRow } from './summary.ts'

function row(overrides: Partial<RawAdInsightRow>): RawAdInsightRow {
  return {
    ad_id: 'ad1',
    date: '2026-09-02',
    ad_name: '美容室_二度目来店_v4_link',
    adset_name: 'adset1',
    campaign_name: 'campaign1',
    effective_status: 'ACTIVE',
    spend: '100',
    impressions: 1000,
    reach: 900,
    clicks: 10,
    leads: 1,
    cost_per_lead: '100',
    ...overrides,
  }
}

Deno.test('spend が文字列で来ても数値として合算される（PostgREST の numeric は string）', () => {
  const rows = [
    row({ ad_id: 'ad1', date: '2026-09-02', spend: '1' }),
    row({ ad_id: 'ad1', date: '2026-09-03', spend: '2' }),
    row({ ad_id: 'ad1', date: '2026-09-04', spend: '3' }),
  ]
  const { ads } = buildAdsSummary(rows)
  assertEquals(ads.length, 1)
  // 文字列連結だと "1" + "2" + "3" = "123" になる。ここが 6 であることを確認する。
  assertEquals(ads[0].spend, 6)
})

Deno.test('同じ広告の複数日を合算し、名前・ステータスは日付が一番新しい行を採用する（行の並び順に依存しない）', () => {
  const rows = [
    row({ ad_id: 'ad1', date: '2026-09-04', ad_name: '美容室_二度目来店_v4_link', effective_status: 'PAUSED', spend: '10', impressions: 100, clicks: 1 }),
    row({ ad_id: 'ad1', date: '2026-09-02', ad_name: '美容室_二度目来店_v4_old', effective_status: 'ACTIVE', spend: '20', impressions: 200, clicks: 2 }),
  ]
  const { ads } = buildAdsSummary(rows)
  assertEquals(ads.length, 1)
  const a = ads[0]
  assertEquals(a.name, '美容室_二度目来店_v4_link')
  assertEquals(a.effectiveStatus, 'PAUSED')
  assertEquals(a.spend, 30)
  assertEquals(a.impressions, 300)
  assertEquals(a.clicks, 3)
})

Deno.test('reach は合算ではなく最大値を採る', () => {
  const rows = [
    row({ ad_id: 'ad1', date: '2026-09-02', reach: 500 }),
    row({ ad_id: 'ad1', date: '2026-09-03', reach: 300 }),
  ]
  const { ads } = buildAdsSummary(rows)
  assertEquals(ads[0].reach, 500)
})

Deno.test('ctr / cpm / costPerLead が正しく計算される', () => {
  const rows = [row({ spend: '500', impressions: 10000, clicks: 200, leads: 5 })]
  const { ads } = buildAdsSummary(rows)
  const a = ads[0]
  assertAlmostEquals(a.ctr, 2) // 200/10000*100
  assertAlmostEquals(a.cpm, 50) // 500/10000*1000
  assertAlmostEquals(a.costPerLead!, 100) // 500/5
})

Deno.test('leads が 0 のとき costPerLead は null（0除算を避ける）', () => {
  const rows = [row({ leads: 0 })]
  const { ads } = buildAdsSummary(rows)
  assertEquals(ads[0].costPerLead, null)
})

Deno.test('業種_訴求_vN をパースできない広告名は その他/その他 バケットに落ちるが消えない', () => {
  const rows = [row({ ad_id: 'ad2', ad_name: '謎の広告' })]
  const { ads } = buildAdsSummary(rows)
  assertEquals(ads.length, 1)
  assertEquals(ads[0].industry, 'その他')
  assertEquals(ads[0].appeal, 'その他')
  assertEquals(ads[0].parsed, false)
})

Deno.test('crossTab は 業種×訴求 で複数広告を正しく合算する', () => {
  const rows = [
    row({ ad_id: 'ad1', ad_name: '美容室_二度目来店_v4_link', spend: '100', impressions: 1000, clicks: 10, leads: 1 }),
    row({ ad_id: 'ad2', ad_name: '美容室_二度目来店_v5_link', spend: '200', impressions: 2000, clicks: 20, leads: 2 }),
    row({ ad_id: 'ad3', ad_name: '飲食店_同じ質問_v3_utm', spend: '50', impressions: 500, clicks: 5, leads: 0 }),
  ]
  const { crossTab } = buildAdsSummary(rows)
  assertEquals(crossTab.length, 2)
  const beauty = crossTab.find((c) => c.industry === '美容室')!
  assertEquals(beauty.spend, 300)
  assertEquals(beauty.impressions, 3000)
  assertEquals(beauty.clicks, 30)
  assertEquals(beauty.leads, 3)
  assertAlmostEquals(beauty.costPerLead!, 100)

  const food = crossTab.find((c) => c.industry === '飲食店')!
  assertEquals(food.costPerLead, null)
})

Deno.test('daily は spend を数値化した上で行ごとにそのまま出力する', () => {
  const rows = [
    row({ ad_id: 'ad1', date: '2026-09-02', spend: '11' }),
    row({ ad_id: 'ad1', date: '2026-09-03', spend: '22' }),
  ]
  const { daily } = buildAdsSummary(rows)
  assertEquals(daily.length, 2)
  assertEquals(daily[0].spend, 11)
  assertEquals(daily[1].spend, 22)
})

Deno.test('空配列を渡しても例外を投げず空の結果を返す', () => {
  const result = buildAdsSummary([])
  assertEquals(result.ads, [])
  assertEquals(result.crossTab, [])
  assertEquals(result.daily, [])
})
