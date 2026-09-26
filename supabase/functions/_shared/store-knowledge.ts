import type { SupabaseClient } from '@supabase/supabase-js'
import { KNOWLEDGE_BASE_MAX_CHARS } from './ai-config.ts'

/**
 * 店舗の AI 学習データ（knowledge_base）と口調設定（ai_settings）を読む。
 *
 * LINE の AI 応答（line-webhook / ai-chat-preview）と同じ材料を、Instagram /
 * Facebook の DM 応答でも使うための共通化。結合・切り詰めの規則を
 * LINE 側と揃えないと「LINE では答えられるのに DM では答えられない」
 * ずれが出るので、上限は必ず KNOWLEDGE_BASE_MAX_CHARS を使う。
 *
 * ai_settings.is_enabled（LINE 側の AI 応答のオン/オフ）はここでは見ない。
 * DM の AI 応答は marketing_settings.ai_reply_enabled で独立に切り替える。
 */

export type StoreKnowledge = {
  storeId: string
  storeName: string | null
  /** 有効な資料を結合し、上限で切り詰めた本文。資料が無ければ空文字。 */
  text: string
  tone: 'polite' | 'friendly'
  personaPrompt: string | null
}

export function joinKnowledgeTexts(texts: Array<string | null | undefined>): string {
  return texts.map((t) => t || '').join('\n\n').substring(0, KNOWLEDGE_BASE_MAX_CHARS)
}

export async function loadStoreKnowledge(
  admin: SupabaseClient,
  storeId: string,
): Promise<StoreKnowledge> {
  const [{ data: store }, { data: docs, error: docsError }, { data: settings }] = await Promise.all([
    admin.from('stores').select('name').eq('id', storeId).maybeSingle(),
    admin
      .from('knowledge_base')
      .select('extracted_text')
      .eq('store_id', storeId)
      .eq('is_active', true)
      // line-webhook は並び順を指定していないが、切り詰めが起きたときに
      // 毎回同じ部分が残るよう、ここでは作成順で固定する。
      .order('created_at', { ascending: true }),
    admin.from('ai_settings').select('tone, persona_prompt').eq('store_id', storeId).maybeSingle(),
  ])
  if (docsError) throw docsError

  return {
    storeId,
    storeName: (store?.name as string | null | undefined) ?? null,
    text: joinKnowledgeTexts((docs ?? []).map((d: { extracted_text?: string | null }) => d.extracted_text)),
    tone: settings?.tone === 'friendly' ? 'friendly' : 'polite',
    personaPrompt: (settings?.persona_prompt as string | null | undefined)?.trim() || null,
  }
}
