import { useCallback, useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'

/**
 * DM 受信箱のデータ取得。
 *
 * social_conversations / social_messages は RLS 有効・SELECT ポリシーは
 * current_user_is_admin() のみ（投稿キュー・広告と同じ「管理者専用」の形）。
 * 一覧・スレッドはテーブルを直接 select できるので Edge Function を経由しない。
 * 「今すぐ取得」だけ social-dm-poll を呼ぶ。
 */

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

export type ConversationSummary = {
  id: string
  platform: 'instagram' | 'facebook'
  displayName: string | null
  lastMessageAt: string | null
  lastInboundAt: string | null
  lastText: string | null
}

export type MessageRow = {
  id: string
  direction: 'inbound' | 'outbound' | 'echo'
  messageType: 'text' | 'image' | 'story_reply' | 'story_reaction' | 'reaction' | 'other'
  text: string | null
  occurredAt: string
}

export function useSocialInbox() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const { data: convRows, error: convError } = await supabase
        .from('social_conversations')
        .select('id, platform, last_message_at, last_inbound_at, social_identities(display_name)')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(100)
      if (convError) throw convError

      const ids = (convRows ?? []).map((c) => c.id)
      const lastTextByConversation = new Map<string, string | null>()
      if (ids.length > 0) {
        const { data: msgRows, error: msgError } = await supabase
          .from('social_messages')
          .select('conversation_id, text, occurred_at')
          .in('conversation_id', ids)
          .order('occurred_at', { ascending: false })
        if (msgError) throw msgError
        for (const m of msgRows ?? []) {
          if (!lastTextByConversation.has(m.conversation_id)) {
            lastTextByConversation.set(m.conversation_id, m.text)
          }
        }
      }

      setConversations(
        (convRows ?? []).map((c) => ({
          id: c.id,
          platform: c.platform,
          displayName: (c.social_identities as unknown as { display_name: string | null } | null)?.display_name ?? null,
          lastMessageAt: c.last_message_at,
          lastInboundAt: c.last_inbound_at,
          lastText: lastTextByConversation.get(c.id) ?? null,
        })),
      )
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // 新着メッセージ・会話更新を即座に一覧へ反映する。
  useEffect(() => {
    const channel = supabase
      .channel('social-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_messages' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_conversations' }, () => void refresh())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refresh])

  const syncNow = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setSyncing(true)
    try {
      const { data, error } = await supabase.functions.invoke('social-dm-poll', { body: {} })
      if (error) throw new Error(await extractFunctionError(error, '通信に失敗しました'))
      await refresh()
      const results = data?.results as Record<string, { conversations?: number; messages?: number; skipped?: boolean }> | undefined
      const ig = results?.instagram
      const parts: string[] = []
      if (ig?.skipped) parts.push('Instagram: 未設定')
      else parts.push(`Instagram: 会話${ig?.conversations ?? 0}件 / メッセージ${ig?.messages ?? 0}件`)
      return { success: true, message: parts.join(' / ') }
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : '取得に失敗しました' }
    } finally {
      setSyncing(false)
    }
  }, [refresh])

  return { conversations, loading, loadError, syncing, refresh, syncNow }
}

export function useConversationMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [drafting, setDrafting] = useState(false)

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      setLoadError(null)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('social_messages')
        .select('id, direction, message_type, text, occurred_at')
        .eq('conversation_id', conversationId)
        .order('occurred_at', { ascending: true })
      if (error) throw error
      setMessages(
        (data ?? []).map((m) => ({
          id: m.id,
          direction: m.direction,
          messageType: m.message_type,
          text: m.text,
          occurredAt: m.occurred_at,
        })),
      )
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`social-messages-${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'social_messages', filter: `conversation_id=eq.${conversationId}` },
        () => void refresh(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, refresh])

  const sendReply = useCallback(
    async (text: string, sentBy: 'manual' | 'ai_draft_approved'): Promise<{ success: boolean; message: string }> => {
      if (!conversationId) return { success: false, message: '会話が選択されていません' }
      setSending(true)
      try {
        const { error } = await supabase.functions.invoke('social-send-reply', {
          body: { conversationId, text, sentBy },
        })
        if (error) throw new Error(await extractFunctionError(error, '送信に失敗しました'))
        await refresh()
        return { success: true, message: '送信しました' }
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : '送信に失敗しました' }
      } finally {
        setSending(false)
      }
    },
    [conversationId, refresh],
  )

  const generateDraft = useCallback(async (): Promise<{ success: boolean; message: string; draft?: string }> => {
    if (!conversationId) return { success: false, message: '会話が選択されていません' }
    setDrafting(true)
    try {
      const { data, error } = await supabase.functions.invoke('social-draft-reply', {
        body: { conversationId },
      })
      if (error) throw new Error(await extractFunctionError(error, '下書きの生成に失敗しました'))
      const draft = data?.draft as string | undefined
      if (!draft) return { success: false, message: '下書きの生成に失敗しました' }
      return { success: true, message: '下書きを生成しました', draft }
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : '下書きの生成に失敗しました' }
    } finally {
      setDrafting(false)
    }
  }, [conversationId])

  return { messages, loading, loadError, sending, drafting, sendReply, generateDraft }
}
