import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

/**
 * 店舗の「要対応」メッセージの件数（期間を問わない）。
 * サイドバーのバッジに使う。受信や対応済みへの変更があればその場で数え直す。
 */
export function useManualReplyCount(storeId: string | null) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!storeId) return
    let cancelled = false

    const refresh = () =>
      supabase
        .from('customer_logs')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('status', 'manual_reply_needed')
        .then(({ count: next, error }) => {
          if (cancelled) return
          if (error) {
            console.error('Error counting manual replies:', error)
            return
          }
          setCount(next ?? 0)
        })

    refresh()

    const channel = supabase
      .channel(`manual-reply-count-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_logs', filter: `store_id=eq.${storeId}` },
        () => refresh(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [storeId])

  return storeId ? count : 0
}
