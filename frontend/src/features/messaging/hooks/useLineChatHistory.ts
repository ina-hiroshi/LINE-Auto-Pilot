import { useCallback, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatCustomerLabel } from '../../customers/lib/customerDisplayName'
import { RECEIVED_IMAGES_BUCKET } from '../lib/lineImage'
import type { LogEntry } from '../types'

/** 受信画像の署名 URL の有効期間。モーダルを開いている間に切れない長さにする */
const SIGNED_URL_SECONDS = 60 * 60

/**
 * お客様が送った画像は非公開バケットにあるので、表示用に署名 URL をまとめて発行する。
 * 発行に失敗しても履歴は表示する（画像の欄が文言だけになる）。
 */
async function attachReceivedImageUrls(rows: LogEntry[]): Promise<LogEntry[]> {
  // 保存期間を過ぎて削除済みの画像は、署名 URL を発行しても開けない
  const paths = [
    ...new Set(
      rows
        .filter((r) => !r.message_image_deleted_at)
        .map((r) => r.message_image_path)
        .filter((p): p is string => Boolean(p)),
    ),
  ]
  if (paths.length === 0) return rows

  try {
    const { data, error } = await supabase.storage
      .from(RECEIVED_IMAGES_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_SECONDS)
    if (error) throw error
    const urlByPath = new Map<string, string>()
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl)
    }
    return rows.map((r) =>
      r.message_image_path && !r.message_image_deleted_at ? { ...r, message_image_url: urlByPath.get(r.message_image_path) ?? null } : r,
    )
  } catch (error) {
    console.error('Error signing LINE image URLs:', error)
    return rows
  }
}

type CustomerForLogLabel = {
  real_name?: string | null
  display_name?: string | null
}

export function useLineChatHistory(storeId: string | null) {
  const [chatHistory, setChatHistory] = useState<LogEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchChatHistory = useCallback(
    async (
      lineUserIds: string | string[],
      limit = 50,
      labelCustomer?: CustomerForLogLabel | null,
    ) => {
      if (!storeId) return
      const ids = [...new Set(Array.isArray(lineUserIds) ? lineUserIds : [lineUserIds])].filter(Boolean)
      if (ids.length === 0) return

      setHistoryLoading(true)
      try {
        const { data, error } = await supabase
          .from('customer_logs')
          .select('*')
          .eq('store_id', storeId)
          .in('line_user_id', ids)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (error) throw error
        // 表示は古い順（下に最新）
        let rows = ((data as LogEntry[]) ?? []).slice().reverse()
        if (labelCustomer) {
          const label = formatCustomerLabel(labelCustomer)
          rows = rows.map((log) => ({ ...log, display_name: label }))
        }
        setChatHistory(await attachReceivedImageUrls(rows))
      } catch (error) {
        console.error('Error fetching chat history:', error)
        setChatHistory([])
      } finally {
        setHistoryLoading(false)
      }
    },
    [storeId],
  )

  return { chatHistory, setChatHistory, historyLoading, fetchChatHistory }
}
