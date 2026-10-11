import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type MonitorCapacity = { capacity: number; remaining: number; isFull: boolean }

/**
 * モニター店舗の枠数（公開の Edge Function get-monitor-capacity）。
 * 「先着◯店舗・残り◯店舗」は実際の枠数でだけ出す（有利誤認を避ける）。
 * 取得に失敗したときは null のままにし、呼び出し側は枠数の表示を出さない。
 */
export function useMonitorCapacity(): MonitorCapacity | null {
  const [capacity, setCapacity] = useState<MonitorCapacity | null>(null)

  useEffect(() => {
    let active = true
    supabase.functions
      .invoke('get-monitor-capacity')
      .then(({ data, error }) => {
        if (!active || error || !data) return
        setCapacity({ capacity: data.capacity, remaining: data.remaining, isFull: data.isFull })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return capacity
}
