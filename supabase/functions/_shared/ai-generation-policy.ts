import type { SupabaseClient } from '@supabase/supabase-js'
import { ClientVisibleError } from './error-utils.ts'
import { isPaidPlan } from './plan-utils.ts'

export const MAX_PREVIEW_MESSAGE_LENGTH = 4000
export const MAX_PERSONA_LENGTH = 4000
export const MAX_TARGET_DETAIL_LENGTH = 1000

export function boundedText(value: unknown, max: number, label: string, required = false): string {
  if (value == null && !required) return ''
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new ClientVisibleError(`${label}は${max}文字以内の文字列で指定してください`, 400)
  }
  return value.trim()
}

export function validatePreviewInput(message: unknown, settings: unknown) {
  const text = boundedText(message, MAX_PREVIEW_MESSAGE_LENGTH, 'メッセージ', true)
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new ClientVisibleError('AI設定が正しくありません', 400)
  }
  const input = settings as Record<string, unknown>
  if (input.tone !== 'friendly' && input.tone !== 'polite') {
    throw new ClientVisibleError('AIの口調が正しくありません', 400)
  }
  return {
    message: text,
    settings: {
      tone: input.tone,
      persona_prompt: boundedText(input.persona_prompt, MAX_PERSONA_LENGTH, '役割指示'),
    },
  }
}

/** 管理者のプランではなく、利用する店舗のオーナーのプランを確認する。 */
export async function requirePaidAiPlan(admin: SupabaseClient, storeId: string): Promise<void> {
  const { data: store, error: storeError } = await admin.from('stores')
    .select('owner_id').eq('id', storeId).single()
  if (storeError || !store) throw new ClientVisibleError('店舗が見つかりません', 404)
  const { data: profile, error } = await admin.from('profiles')
    .select('plan').eq('id', store.owner_id).single()
  if (error) throw new ClientVisibleError('プランを確認できませんでした', 503)
  if (!isPaidPlan(profile?.plan)) {
    throw new ClientVisibleError('AI機能はProプラン以上でご利用いただけます', 403)
  }
}

/** 呼び出し前に枠を確保する。失敗した生成も使用回数に含む。DB障害時は生成しない。 */
export async function reserveAiGeneration(
  admin: SupabaseClient,
  storeId: string,
  feature: 'ai-chat-preview' | 'campaign-generator',
): Promise<void> {
  const { data, error } = await admin.rpc('reserve_ai_generation', {
    p_store_id: storeId,
    p_feature: feature,
  })
  if (error || typeof data !== 'boolean') {
    throw new ClientVisibleError('AI利用回数を確認できませんでした', 503)
  }
  if (!data) {
    throw new ClientVisibleError('AIの利用が集中しています。しばらく時間をおいてからお試しください。', 429)
  }
}
