import { useCallback, useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'

/**
 * 接続状態（トークン）と広報の運用設定の読み書き。
 * meta_credentials / marketing_settings は RLS 有効・ポリシーゼロなので
 * marketing-settings Edge Function 経由で読む。
 */

export type CredentialView = {
  id: 'instagram_login' | 'facebook_page'
  platform: 'instagram' | 'facebook'
  account_ref: string
  token_type: string
  expires_at: string | null
  data_access_expires_at: string | null
  scopes: string[] | null
  last_refreshed_at: string | null
  last_checked_at: string | null
  last_error: string | null
  status: 'active' | 'needs_reauth' | 'expired'
  missingExtendedScopes: string[]
}

export type MarketingSettingsView = {
  social_autopost_enabled: boolean
  auto_reply_enabled: boolean
  auto_reply_dry_run: boolean
}

type GetResponse = { settings: MarketingSettingsView; credentials: CredentialView[] }
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

export function useMarketingSettings() {
  const [settings, setSettings] = useState<MarketingSettingsView | null>(null)
  const [credentials, setCredentials] = useState<CredentialView[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('marketing-settings', { body })
    if (error) throw new Error(await extractFunctionError(error, '通信に失敗しました'))
    return data
  }, [])

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const data = (await call({ action: 'get' })) as GetResponse
      setSettings(data.settings)
      setCredentials(data.credentials)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [call])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const updateSetting = useCallback(
    async (patch: Partial<MarketingSettingsView>): Promise<ActionResult> => {
      const key = Object.keys(patch)[0] ?? 'settings'
      setBusy(key)
      try {
        await call({ action: 'update_settings', ...patch })
        await refresh()
        return { success: true, message: '設定を保存しました' }
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : '保存に失敗しました' }
      } finally {
        setBusy(null)
      }
    },
    [call, refresh],
  )

  const refreshTokensNow = useCallback(async (): Promise<ActionResult> => {
    setBusy('refresh_now')
    try {
      const data = (await call({ action: 'refresh_now' })) as { ok: boolean; result?: { alerted?: boolean } }
      await refresh()
      if (!data.ok) return { success: false, message: '確認に失敗しました' }
      return {
        success: true,
        message: data.result?.alerted ? '確認しました（要対応の項目があります）' : '確認しました。問題ありません',
      }
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : '確認に失敗しました' }
    } finally {
      setBusy(null)
    }
  }, [call, refresh])

  return { settings, credentials, loading, busy, loadError, refresh, updateSetting, refreshTokensNow }
}
