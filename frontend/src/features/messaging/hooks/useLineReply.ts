import { useCallback, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'

type SendLineMessageParams = {
  storeId: string
  userId: string
  text: string
  replyToLogId?: string
  customerId?: string
  displayName?: string | null
  profilePictureUrl?: string | null
}

async function extractFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const body = await error.context.json()
      if (body?.error && typeof body.error === 'string') return body.error
    } catch {
      /* ignore */
    }
  }
  return '送信に失敗しました'
}

export function useLineReply() {
  const [sending, setSending] = useState(false)

  const sendMessage = useCallback(async (params: SendLineMessageParams) => {
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('認証エラー')

      const { data, error } = await supabase.functions.invoke('send-line-message', {
        body: params,
      })

      if (error) {
        const message = await extractFunctionError(error)
        return { success: false as const, message }
      }

      if (data?.error) {
        return { success: false as const, message: String(data.error) }
      }

      return {
        success: true as const,
        lineUserId: typeof data?.lineUserId === 'string' ? data.lineUserId : undefined,
      }
    } catch (e) {
      console.error('Send LINE message error:', e)
      const message = e instanceof Error ? e.message : '送信に失敗しました'
      return { success: false as const, message }
    } finally {
      setSending(false)
    }
  }, [])

  const resolveLog = useCallback(async (logId: string) => {
    try {
      const { error } = await supabase
        .from('customer_logs')
        .update({ status: 'resolved' })
        .eq('id', logId)
      if (error) throw error
      return { success: true as const }
    } catch (e) {
      console.error('Resolve log error:', e)
      return { success: false as const }
    }
  }, [])

  return { sendMessage, resolveLog, sending }
}
