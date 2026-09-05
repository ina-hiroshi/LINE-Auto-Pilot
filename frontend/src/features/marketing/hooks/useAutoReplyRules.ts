import { useCallback, useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'

/**
 * 自動応答（キーワードルール）の管理。social_auto_reply_rules は
 * RLS 有効・SELECT ポリシーのみ（書き込みは service_role 専用）なので
 * marketing-posts と同じく Edge Function 経由で読み書きする。
 */

export type AutoReplyRule = {
  id: string
  platform: 'instagram' | 'facebook'
  account_ref: string
  keyword: string
  sub_keywords: string[]
  response_text: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AutoReplyHit = {
  id: string
  conversation_id: string
  rule_id: string | null
  matched_score: number | null
  created_at: string
  displayName: string | null
  platform: 'instagram' | 'facebook' | null
}

export type OutboundQueueRow = {
  id: string
  conversation_id: string
  text: string | null
  status: 'pending' | 'dry_run' | 'sent' | 'skipped' | 'failed'
  created_at: string
  sent_at: string | null
  last_error: string | null
}

type ActionResult = { success: boolean; message?: string }

async function extractFunctionError(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const body = await error.context.json()
      if (typeof body?.error === 'string') return body.error
    } catch {
      /* JSON でないレスポンスは既定文言に落とす */
    }
    if (error.context.status === 403) return 'この操作の権限がありません'
    return `${fallback}（HTTP ${error.context.status}）`
  }
  return fallback
}

export type RuleInput = {
  platform: 'instagram' | 'facebook'
  accountRef: string
  keyword: string
  subKeywords: string[]
  responseText: string
  isActive: boolean
}

export function useAutoReplyRules() {
  const [rules, setRules] = useState<AutoReplyRule[]>([])
  const [hits, setHits] = useState<AutoReplyHit[]>([])
  const [queue, setQueue] = useState<OutboundQueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('social-auto-reply-rules', { body })
    if (error) throw new Error(await extractFunctionError(error, '通信に失敗しました'))
    return data
  }, [])

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const data = (await call({ action: 'list' })) as {
        rules: AutoReplyRule[]
        hits: Array<{
          id: string
          conversation_id: string
          rule_id: string | null
          matched_score: number | null
          created_at: string
          social_conversations: {
            platform: 'instagram' | 'facebook'
            social_identities: { display_name: string | null } | null
          } | null
        }>
        queue: Array<{
          id: string
          conversation_id: string
          message: { text?: string } | null
          status: OutboundQueueRow['status']
          created_at: string
          sent_at: string | null
          last_error: string | null
        }>
      }
      setRules(data.rules)
      setHits(
        data.hits.map((h) => ({
          id: h.id,
          conversation_id: h.conversation_id,
          rule_id: h.rule_id,
          matched_score: h.matched_score,
          created_at: h.created_at,
          displayName: h.social_conversations?.social_identities?.display_name ?? null,
          platform: h.social_conversations?.platform ?? null,
        })),
      )
      setQueue(
        data.queue.map((q) => ({
          id: q.id,
          conversation_id: q.conversation_id,
          text: q.message?.text ?? null,
          status: q.status,
          created_at: q.created_at,
          sent_at: q.sent_at,
          last_error: q.last_error,
        })),
      )
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [call])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createRule = useCallback(
    async (input: RuleInput): Promise<ActionResult> => {
      setBusy('create')
      try {
        await call({ action: 'create', ...toPayload(input) })
        await refresh()
        return { success: true, message: 'ルールを追加しました' }
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : '追加に失敗しました' }
      } finally {
        setBusy(null)
      }
    },
    [call, refresh],
  )

  const updateRule = useCallback(
    async (id: string, input: RuleInput): Promise<ActionResult> => {
      setBusy(id)
      try {
        await call({ action: 'update', id, ...toPayload(input) })
        await refresh()
        return { success: true, message: 'ルールを更新しました' }
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : '更新に失敗しました' }
      } finally {
        setBusy(null)
      }
    },
    [call, refresh],
  )

  const deleteRule = useCallback(
    async (id: string): Promise<ActionResult> => {
      setBusy(id)
      try {
        await call({ action: 'delete', id })
        await refresh()
        return { success: true, message: 'ルールを削除しました' }
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : '削除に失敗しました' }
      } finally {
        setBusy(null)
      }
    },
    [call, refresh],
  )

  const setActive = useCallback(
    async (id: string, isActive: boolean): Promise<ActionResult> => {
      setBusy(id)
      try {
        await call({ action: 'set_active', id, isActive })
        await refresh()
        return { success: true }
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : '更新に失敗しました' }
      } finally {
        setBusy(null)
      }
    },
    [call, refresh],
  )

  return { rules, hits, queue, loading, busy, loadError, refresh, createRule, updateRule, deleteRule, setActive }
}

function toPayload(input: RuleInput) {
  return {
    platform: input.platform,
    accountRef: input.accountRef,
    keyword: input.keyword,
    subKeywords: input.subKeywords,
    responseText: input.responseText,
    isActive: input.isActive,
  }
}
