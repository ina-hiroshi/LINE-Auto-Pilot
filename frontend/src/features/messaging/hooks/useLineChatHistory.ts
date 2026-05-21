import { useCallback, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatCustomerLabel } from '../../customers/lib/customerDisplayName'
import type { LogEntry } from '../types'

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
        setChatHistory(rows)
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
