import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { LineQuotaInfo } from '../../../components/line/LineMessagingQuotaNotice'
import { LineChatHistory } from '../../messaging/components/LineChatHistory'
import { LineReplyComposer } from '../../messaging/components/LineReplyComposer'
import { useLineChatHistory } from '../../messaging/hooks/useLineChatHistory'
import { useLineReply } from '../../messaging/hooks/useLineReply'
import {
  resolveMessagingLineUserId,
  resolveMessagingLineUserIds,
} from '../../messaging/lib/resolveMessagingLineUserId'
import { formatCustomerLabel } from '../lib/customerDisplayName'
import type { CustomerDetail } from '../types'
import type { LogEntry } from '../../messaging/types'

type CustomerMessagesTabProps = {
  storeId: string
  customer: CustomerDetail
  highlightLogId?: string | null
  onToast: (message: string, type: 'success' | 'error') => void
}

export function CustomerMessagesTab({
  storeId,
  customer,
  highlightLogId = null,
  onToast,
}: CustomerMessagesTabProps) {
  const [replyText, setReplyText] = useState('')
  const [quotaInfo, setQuotaInfo] = useState<LineQuotaInfo | null>(null)
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [messagingUserId, setMessagingUserId] = useState(customer.line_user_id)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { chatHistory, fetchChatHistory, historyLoading, setChatHistory } = useLineChatHistory(storeId)
  const { sendMessage, resolveLog, sending } = useLineReply()

  const customerLineUserId = customer.line_user_id
  const customerForMessaging = {
    line_user_id: customerLineUserId,
    display_name: customer.display_name,
    real_name: customer.real_name,
  }

  const reloadHistory = useCallback(async () => {
    const ids = await resolveMessagingLineUserIds(storeId, customerForMessaging)
    const primary = await resolveMessagingLineUserId(storeId, customerForMessaging)
    setMessagingUserId(primary)
    await fetchChatHistory(ids, 100, customer)
  }, [storeId, customerLineUserId, customer.display_name, customer.real_name, fetchChatHistory])

  useEffect(() => {
    reloadHistory()
  }, [reloadHistory])

  useEffect(() => {
    if (highlightLogId && chatHistory.length > 0) {
      const log = chatHistory.find((m) => m.id === highlightLogId) ?? null
      setSelectedLog(log)
    }
  }, [highlightLogId, chatHistory])

  useEffect(() => {
    if (!storeId) return
    const fetchQuota = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-line-quota', {
          body: { storeId },
        })
        if (error) throw error
        setQuotaInfo(data as LineQuotaInfo)
      } catch (e) {
        console.error('quota:', e)
      }
    }
    fetchQuota()
  }, [storeId])

  useEffect(() => {
    if (!storeId) return

    const channel = supabase
      .channel(`customer-logs-${customer.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_logs',
          filter: `store_id=eq.${storeId}`,
        },
        () => reloadHistory(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId, customer.id, reloadHistory])

  const handleSend = async () => {
    if (!replyText.trim()) return
    const pushUserId = selectedLog?.line_user_id ?? messagingUserId

    const result = await sendMessage({
      storeId,
      userId: pushUserId,
      customerId: customer.id,
      text: replyText,
      replyToLogId: selectedLog?.status === 'manual_reply_needed' ? selectedLog.id : undefined,
      displayName: formatCustomerLabel(customer),
      profilePictureUrl: customer.profile_picture_url,
    })

    if (result.success) {
      onToast('メッセージを送信しました', 'success')
      setReplyText('')
      setSelectedLog(null)
      if (result.lineUserId) setMessagingUserId(result.lineUserId)
      await reloadHistory()
    } else {
      onToast(result.message ?? '送信に失敗しました', 'error')
    }
  }

  const handleResolve = async () => {
    if (!selectedLog) return
    const result = await resolveLog(selectedLog.id)
    if (result.success) {
      onToast('対応済にしました', 'success')
      setChatHistory((prev) =>
        prev.map((l) => (l.id === selectedLog.id ? { ...l, status: 'resolved' as const } : l)),
      )
      setSelectedLog(null)
    } else {
      onToast('更新に失敗しました', 'error')
    }
  }

  return (
    <div className="space-y-4 w-full">
      {chatHistory.length === 0 && !historyLoading && (
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          この顧客とのメッセージ履歴はまだありません。下の入力欄から送信すると、ここに表示されます。
        </p>
      )}

      <LineChatHistory
        messages={chatHistory}
        loading={historyLoading}
        highlightLogId={selectedLog?.id ?? highlightLogId}
        scrollRef={scrollRef}
      />

      {chatHistory.some((m) => m.status === 'manual_reply_needed') && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          要対応のメッセージがある場合、返信するとそのスレッドに紐づけて送信されます。新規連絡は下の入力欄から送信できます。
        </p>
      )}

      <LineReplyComposer
        replyText={replyText}
        onReplyTextChange={setReplyText}
        onSend={handleSend}
        onResolve={selectedLog?.status === 'manual_reply_needed' ? handleResolve : undefined}
        showResolve={selectedLog?.status === 'manual_reply_needed'}
        sending={sending}
        quotaInfo={quotaInfo}
        label="メッセージ"
        placeholder="顧客へ送るメッセージを入力..."
      />
    </div>
  )
}
