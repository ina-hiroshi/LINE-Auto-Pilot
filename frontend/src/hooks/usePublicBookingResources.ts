import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { StoreMenu, StoreStaff } from '../types/storeResources'

export type SpecialDateOverride = {
  is_closed: boolean
  override_hours: { start: string; end: string }[] | null
}

export type SpecialDatesMap = Record<string, SpecialDateOverride>

type RawSpecialDate = { date: string; is_closed: boolean; override_hours: SpecialDateOverride['override_hours'] }

function toSpecialDatesMap(rows: RawSpecialDate[]): SpecialDatesMap {
  const map: SpecialDatesMap = {}
  for (const row of rows) {
    map[row.date] = { is_closed: row.is_closed, override_hours: row.override_hours }
  }
  return map
}

/**
 * LIFF の公開予約画面（ログイン不要）向けにスタッフ・メニュー・特定日設定を取得する。
 *
 * staff_members / booking_menus / booking_special_dates は以前 anon キーで
 * テーブルを直接読んでいたが、店舗を絞る RLS が無く全店舗ぶんが読めてしまっていた。
 * booking Edge Function の get_booking_resources（store_id 必須・公開列のみ）
 * 経由に寄せることで、anon の直接テーブルアクセスを塞げるようにする。
 */
export function usePublicBookingResources(storeId: string | null) {
  const [staffList, setStaffList] = useState<StoreStaff[]>([])
  const [menuList, setMenuList] = useState<StoreMenu[]>([])
  const [specialDates, setSpecialDates] = useState<SpecialDatesMap>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('booking', {
        body: { action: 'get_booking_resources', store_id: storeId },
      })

      if (invokeError) throw invokeError
      if (data?.error) throw new Error(String(data.error))

      setStaffList(Array.isArray(data?.staffList) ? data.staffList : [])
      setMenuList(Array.isArray(data?.menuList) ? data.menuList : [])
      setSpecialDates(toSpecialDatesMap(Array.isArray(data?.specialDates) ? data.specialDates : []))
    } catch (e) {
      console.error('Failed to fetch public booking resources', e)
      setError(e instanceof Error ? e.message : '店舗情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    staffList,
    menuList,
    specialDates,
    loading,
    error,
    setStaffList,
    setMenuList,
    setSpecialDates,
    refresh,
  }
}
