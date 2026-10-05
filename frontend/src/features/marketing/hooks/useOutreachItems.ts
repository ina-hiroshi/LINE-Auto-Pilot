import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

/**
 * 手動で行う広報施策（X の手動投稿、Instagram の攻めDM）の台帳。
 *
 * marketing_outreach_items は管理者だけが select / update できる RLS を持つので、
 * 他の広報画面と違い Edge Function を通さず直接読み書きする。
 * 行の追加・削除は画面からは行わない（SQL で投入する）。
 * Instagram のDMは、画面の「本文をコピーしてDMを開く」を押した時点で done_at を付ける。
 * ボタンを使わずに送った分は、送信が取り込まれたときに DB のトリガーが付ける。
 */

export type OutreachChannel = 'x' | 'instagram'

export type OutreachItem = {
  id: string
  channel: OutreachChannel
  kind: 'action' | 'guide'
  section: string
  sort_order: number
  title: string
  target_handle: string | null
  target_name: string | null
  target_detail: string | null
  body: string
  note: string | null
  done_at: string | null
  updated_at: string
}

type ActionResult = { success: boolean; message?: string }

export function useOutreachItems() {
  const [items, setItems] = useState<OutreachItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoadError(null)
    const { data, error } = await supabase
      .from('marketing_outreach_items')
      .select('*')
      .order('channel')
      .order('sort_order')
    if (error) setLoadError(error.message)
    else setItems((data ?? []) as OutreachItem[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Instagram でDMを送って戻ってきたときに、DB のトリガーが付けた送信済みを反映する
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [refresh])

  const patch = useCallback(
    async (id: string, values: Partial<Pick<OutreachItem, 'done_at' | 'body'>>, message: string): Promise<ActionResult> => {
      setBusy(id)
      try {
        const { data, error } = await supabase
          .from('marketing_outreach_items')
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('*')
          .single()
        if (error) return { success: false, message: error.message }
        setItems((prev) => prev.map((it) => (it.id === id ? (data as OutreachItem) : it)))
        return { success: true, message }
      } finally {
        setBusy(null)
      }
    },
    [],
  )

  return {
    items,
    loading,
    loadError,
    busy,
    refresh,
    setDone: (id: string, done: boolean) =>
      patch(id, { done_at: done ? new Date().toISOString() : null }, done ? '済みにしました' : '未実施に戻しました'),
    updateBody: (id: string, body: string) => patch(id, { body }, '本文を保存しました'),
  }
}
