import { useCallback, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { LineImageError, prepareImageForLine, uploadImageForLine } from '../lib/lineImage'

type SendLineMessageParams = {
  storeId: string
  userId: string
  text: string
  /** 一緒に送る画像。文と画像のどちらか一方があれば送れる */
  imageFile?: File | null
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
    const { imageFile, ...rest } = params
    if (!rest.text.trim() && !imageFile) {
      return { success: false as const, message: 'メッセージか画像を入力してください' }
    }

    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('認証エラー')

      const imageUrl = imageFile
        ? await uploadImageForLine(rest.storeId, await prepareImageForLine(imageFile))
        : undefined

      const { data, error } = await supabase.functions.invoke('send-line-message', {
        body: imageUrl ? { ...rest, imageUrl } : rest,
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
      if (e instanceof LineImageError) {
        return { success: false as const, message: e.message }
      }
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
