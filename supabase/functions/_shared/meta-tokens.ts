import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * meta_credentials への移行が完了する（Step5で Supabase Secrets から
 * XXX_ACCESS_TOKEN を削除する）までの間、Vault にまだ値が無い呼び出し元を
 * 壊さないための Vault → env フォールバック。
 *
 * カットオーバーの順序が重要（計画 0-4 節）。refresh_access_token は
 * トークンを回転させるため、env と Vault に二重にコピーがある状態で
 * リフレッシュを走らせると env 側が静かに古くなり、9/4 障害を逆方向から
 * 再現する。meta-token-refresh を1回動かして Vault に実体を移してから、
 * 各関数を getToken() 経由に切り替え、最後に env を消す。
 */

export type CredentialId = 'instagram_login' | 'facebook_page'
export type TokenLookup = { token: string; source: 'vault' | 'env' }

/**
 * facebook_page だけ env フォールバックを残す。scripts/refresh_facebook_token.sh は
 * Vault へ直接書く手段を持たず、再認可のたびに Supabase Secrets の
 * FACEBOOK_ACCESS_TOKEN を書き換える運用だから（meta-token-refresh が
 * 次回実行時に Vault へ同期する）。
 *
 * instagram_login にはフォールバックを置かない。IG は refresh_access_token で
 * 毎回トークンを回転させるため、env に残っているのは「回転前の＝失効に近い、
 * あるいは既に失効した」値でしかない。Vault が読めないのに env へ落ちて
 * 「動いているように見える」状態は、9/4 障害と同じ形の事故を静かに再現する。
 */
const ENV_FALLBACK: Partial<Record<CredentialId, string>> = {
  facebook_page: 'FACEBOOK_ACCESS_TOKEN',
}

export async function getToken(admin: SupabaseClient, id: CredentialId): Promise<TokenLookup | null> {
  const { data: cred, error: credError } = await admin
    .from('meta_credentials')
    .select('vault_secret_name')
    .eq('id', id)
    .maybeSingle()
  if (credError) {
    console.error(`getToken(${id}): meta_credentials の読み込みに失敗:`, credError)
  }

  if (cred?.vault_secret_name) {
    const { data: token, error } = await admin.rpc('meta_secret_get', {
      secret_name: cred.vault_secret_name,
    })
    if (!error && typeof token === 'string' && token.length > 0) {
      return { token, source: 'vault' }
    }
    if (error) {
      console.error(`getToken(${id}): meta_secret_get RPC 失敗:`, error)
    }
  }

  const envVar = ENV_FALLBACK[id]
  const envToken = envVar ? Deno.env.get(envVar) : undefined
  return envToken ? { token: envToken, source: 'env' } : null
}

/** Vault へ書き込む。値はこの関数の呼び出し元（Edge Function内）から一歩も出ない。 */
export async function setToken(admin: SupabaseClient, secretName: string, value: string, description: string) {
  const { error } = await admin.rpc('meta_secret_upsert', {
    secret_name: secretName,
    secret_value: value,
    secret_description: description,
  })
  if (error) throw error
}
