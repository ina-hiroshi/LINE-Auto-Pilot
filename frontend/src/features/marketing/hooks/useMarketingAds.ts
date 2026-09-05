import { useCallback, useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'

/**
 * 広告ダッシュボードのデータ取得。
 *
 * meta_ad_insights_daily は RLS 有効・ポリシーゼロなので、投稿キューと同じく
 * marketing-ads Edge Function 経由でしか読めない。
 */

async function extractFunctionError(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const body = await error.context.json()
      if (typeof body?.error === 'string') return body.error
    } catch {
      /* JSON でないレスポンスは既定文言に落とす */
    }
    if (error.context.status === 403) return 'この操作の権限がありません'
    return `${fallback}（HTTP ${error.context.status}）`
  }
  return fallback
}

export type AdSummary = {
  adId: string
  name: string
  adsetName: string | null
  campaignName: string | null
  effectiveStatus: string | null
  industry: string
  appeal: string
  version: number | null
  suffix: string | null
  parsed: boolean
  spend: number
  impressions: number
  reach: number
  clicks: number
  leads: number
  ctr: number
  cpm: number
  costPerLead: number | null
}

export type CrossTabCell = {
  industry: string
  appeal: string
  spend: number
  impressions: number
  clicks: number
  leads: number
  ctr: number
  cpm: number
  costPerLead: number | null
}

export type DailyPoint = {
  date: string
  adId: string
  name: string
  industry: string
  appeal: string
  version: number | null
  spend: number
  impressions: number
  clicks: number
}

export type AdsSummaryView = {
  ads: AdSummary[]
  crossTab: CrossTabCell[]
  daily: DailyPoint[]
  hasAdsRead: boolean
  since: string
}

export function useMarketingAds() {
  const [view, setView] = useState<AdsSummaryView | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('marketing-ads', { body })
    if (error) throw new Error(await extractFunctionError(error, '通信に失敗しました'))
    return data
  }, [])

  const refresh = useCallback(async (windowDays: number = days) => {
    setLoadError(null)
    try {
      setView((await call({ action: 'summary', days: windowDays })) as AdsSummaryView)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [call, days])

  useEffect(() => {
    void refresh(days)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  const syncNow = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setBusy(true)
    try {
      const data = (await call({ action: 'sync_now' })) as { skipped?: boolean; reason?: string; upserted?: number }
      await refresh(days)
      if (data.skipped) return { success: false, message: data.reason ?? '実行できませんでした' }
      return { success: true, message: `${data.upserted ?? 0} 件を取得しました` }
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : '取得に失敗しました' }
    } finally {
      setBusy(false)
    }
  }, [call, refresh, days])

  return { view, loading, busy, loadError, days, setDays, refresh, syncNow }
}
