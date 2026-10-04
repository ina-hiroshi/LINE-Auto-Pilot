import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

/**
 * 製品紹介ページの閲覧集計。
 *
 * site_page_views は RLS 有効・ポリシーなしなので、管理者専用 RPC site_page_view_stats
 * 経由でしか読めない。集計（日本時間の日別など）は RPC 側で済ませてある。
 */

export type TrafficCounts = { views: number; visitors: number; sessions: number }

export type SiteTraffic = {
  days: number
  from: string
  to: string
  totals: TrafficCounts
  previous: TrafficCounts
  /** 集計から外した閲覧数（運営者のブラウザ・bot と判明したもの）。期間内の分。 */
  excluded?: { owner_views: number; bot_views: number }
  daily: { date: string; views: number; visitors: number }[]
  pages: { path: string; views: number; visitors: number }[]
  landings: { path: string; sessions: number }[]
  sources: { source: string; sessions: number }[]
  campaigns: { campaign: string; source: string | null; medium: string | null; sessions: number }[]
  devices: { device: 'mobile' | 'desktop'; views: number }[]
}

async function fetchStats(days: number): Promise<{ data: SiteTraffic | null; error: string | null }> {
  const { data, error } = await supabase.rpc('site_page_view_stats', { p_days: days })
  if (error) {
    return { data: null, error: error.code === '42501' ? 'この画面を見る権限がありません' : '閲覧データを読み込めませんでした' }
  }
  return { data: data as SiteTraffic, error: null }
}

export function useSiteTraffic(days: number) {
  const [data, setData] = useState<SiteTraffic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void fetchStats(days).then((result) => {
      if (cancelled) return
      setData(result.data)
      setError(result.error)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [days, reloadKey])

  // 読み込み中の表示は、期間の切り替えや更新ボタンを押したイベント側で立てる
  const reload = useCallback(() => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }, [])
  const markLoading = useCallback(() => setLoading(true), [])

  return { data, loading, error, reload, markLoading }
}
