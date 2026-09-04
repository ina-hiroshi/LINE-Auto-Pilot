import { useCallback, useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import type { MediaInsight, Platform, QueueView } from '../types'

/**
 * 投稿キューの読み書き。
 *
 * social_posts は RLS 有効・ポリシーゼロなので supabase.from() では読めない。
 * すべて marketing-posts Edge Function 経由で、認可はサーバー側で判定される。
 * 他の画面と作りが違うのはそのため。
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

type ActionResult = { success: boolean; message?: string }

export function useMarketingPosts() {
  const [view, setView] = useState<QueueView | null>(null)
  const [insights, setInsights] = useState<Record<string, MediaInsight>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('marketing-posts', { body })
    if (error) throw new Error(await extractFunctionError(error, '通信に失敗しました'))
    return data
  }, [])

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      setView((await call({ action: 'list' })) as QueueView)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [call])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** 変更系。押している間の二重実行を busy で止め、終わったら必ず読み直す。
   *  成功時の文言はレスポンスから決められる。サーバーが「何もしなかった」と
   *  返したときに「変更しました」と出すと、押しても動かない理由が分からなくなる。 */
  const run = useCallback(
    async (
      key: string,
      body: Record<string, unknown>,
      successMessage: string | ((data: unknown) => string),
    ): Promise<ActionResult> => {
      setBusy(key)
      try {
        const data = await call(body)
        await refresh()
        return {
          success: true,
          message: typeof successMessage === 'function' ? successMessage(data) : successMessage,
        }
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : '操作に失敗しました' }
      } finally {
        setBusy(null)
      }
    },
    [call, refresh],
  )

  const fetchInsights = useCallback(async (): Promise<ActionResult> => {
    setBusy('insights')
    try {
      const data = (await call({ action: 'insights' })) as { insights: MediaInsight[] }
      const map: Record<string, MediaInsight> = {}
      for (const item of data.insights ?? []) map[item.slug] = item
      setInsights(map)
      return { success: true, message: '実績を取得しました' }
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : '実績の取得に失敗しました' }
    } finally {
      setBusy(null)
    }
  }, [call])

  return {
    view,
    insights,
    loading,
    busy,
    loadError,
    refresh,
    fetchInsights,
    /** platform を省くと、その slug の未投稿行すべてに同じ本文を書く。
     *  本文がプラットフォームごとに違う場合は必ず platform を指定すること。 */
    updateCaption: (slug: string, caption: string, platform?: Platform) =>
      run(
        `caption:${slug}:${platform ?? 'all'}`,
        { action: 'update_caption', slug, caption, platform },
        'キャプションを保存しました',
      ),
    reorder: (slug: string, direction: 'up' | 'down') =>
      run(`reorder:${slug}`, { action: 'reorder', slug, direction }, (data) =>
        (data as { moved?: boolean })?.moved === false
          ? 'これ以上は動かせません'
          : '並び順を変更しました',
      ),
    retry: (slug: string, platform?: string) =>
      run(`retry:${slug}`, { action: 'retry', slug, platform }, 'キューに戻しました'),
    abandon: (slug: string, platform?: string) =>
      run(`abandon:${slug}`, { action: 'abandon', slug, platform }, 'キューから外しました'),
    publishNext: () =>
      run('publish', { action: 'publish_next' }, '投稿処理を実行しました'),
  }
}
