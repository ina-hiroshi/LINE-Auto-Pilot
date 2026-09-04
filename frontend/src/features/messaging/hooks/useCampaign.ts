import { useCallback, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import type { SegmentParams, SegmentType } from '../types'

/**
 * 一斉配信まわりの Edge Function 呼び出し。
 * useLineReply と同じく、エラーは throw せず結果オブジェクトで返す。
 */

async function extractFunctionError(error: unknown, fallback: string): Promise<{
  message: string
  status?: number
  currentPlan?: string | null
}> {
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const body = await error.context.json()
      if (body?.error && typeof body.error === 'string') {
        return {
          message: body.error,
          status: error.context.status,
          currentPlan: body.currentPlan ?? null,
        }
      }
    } catch {
      /* JSON でないレスポンスは既定文言に落とす */
    }
    return { message: fallback, status: error.context.status }
  }
  return { message: fallback }
}

export type SegmentPreview = {
  count: number
  sampleNames: string[]
}

export function useSegmentPreview() {
  const [preview, setPreview] = useState<SegmentPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPreview = useCallback(
    async (storeId: string, segmentType: SegmentType, segmentParams: SegmentParams) => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: invokeError } = await supabase.functions.invoke('get-segment-preview', {
          body: { storeId, segmentType, segmentParams },
        })

        if (invokeError) {
          const { message } = await extractFunctionError(invokeError, '配信対象の取得に失敗しました')
          setError(message)
          setPreview(null)
          return
        }

        setPreview({ count: data?.count ?? 0, sampleNames: data?.sampleNames ?? [] })
      } catch (e) {
        console.error('Segment preview error:', e)
        setError('配信対象の取得に失敗しました')
        setPreview(null)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { preview, loading, error, fetchPreview, setPreview }
}

export type GenerateParams = {
  storeId: string
  segmentType: SegmentType
  targetDetail?: string | null
  purpose: string
  tone: 'friendly' | 'polite' | 'casual'
  keywords?: string
}

export type GenerateResult =
  | { success: true; variations: string[] }
  | { success: false; message: string; planRequired: boolean }

export function useCampaignGenerate() {
  const [generating, setGenerating] = useState(false)

  const generate = useCallback(async (params: GenerateParams): Promise<GenerateResult> => {
    setGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-campaign-message', {
        body: params,
      })

      if (error) {
        const { message, status } = await extractFunctionError(error, '文章の生成に失敗しました')
        // 403 はプラン制限。アップグレード導線を出すために区別する
        return { success: false, message, planRequired: status === 403 }
      }

      const variations = (data?.variations ?? [])
        .map((item: { text?: string }) => item?.text ?? '')
        .filter((text: string) => text.trim().length > 0)

      if (variations.length === 0) {
        return { success: false, message: '文章の生成に失敗しました', planRequired: false }
      }

      return { success: true, variations }
    } catch (e) {
      console.error('Campaign generate error:', e)
      return { success: false, message: '文章の生成に失敗しました', planRequired: false }
    } finally {
      setGenerating(false)
    }
  }, [])

  return { generate, generating }
}

export type SendParams = {
  storeId: string
  segmentType: SegmentType
  segmentParams: SegmentParams
  messageText: string
  aiGenerated: boolean
}

export type SendResult =
  | { success: true; campaignId: string; sentCount: number; failedCount: number; status: string }
  | { success: false; message: string }

export function useCampaignSend() {
  const [sending, setSending] = useState(false)

  const send = useCallback(async (params: SendParams): Promise<SendResult> => {
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-line-bulk-message', {
        body: params,
      })

      if (error) {
        const { message } = await extractFunctionError(error, '配信に失敗しました')
        return { success: false, message }
      }

      return {
        success: true,
        campaignId: String(data?.campaignId ?? ''),
        sentCount: data?.sentCount ?? 0,
        failedCount: data?.failedCount ?? 0,
        status: String(data?.status ?? 'sending'),
      }
    } catch (e) {
      console.error('Campaign send error:', e)
      return { success: false, message: '配信に失敗しました' }
    } finally {
      setSending(false)
    }
  }, [])

  /** 途中で止まった配信の続きを送る */
  const resume = useCallback(async (storeId: string, campaignId: string): Promise<SendResult> => {
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-line-bulk-message', {
        body: { storeId, resumeCampaignId: campaignId },
      })

      if (error) {
        const { message } = await extractFunctionError(error, '再開に失敗しました')
        return { success: false, message }
      }

      return {
        success: true,
        campaignId,
        sentCount: data?.sentCount ?? 0,
        failedCount: data?.failedCount ?? 0,
        status: String(data?.status ?? 'sending'),
      }
    } catch (e) {
      console.error('Campaign resume error:', e)
      return { success: false, message: '再開に失敗しました' }
    } finally {
      setSending(false)
    }
  }, [])

  return { send, resume, sending }
}
