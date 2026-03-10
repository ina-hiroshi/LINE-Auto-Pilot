import { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const ADMIN_EMAILS = ['sky.voltric424@gmail.com']

/**
 * DB の is_admin フラグ + フォールバックメールリストで管理者判定。
 * クライアント側 useUserFeatures と同じロジックを保つ。
 */
export async function isAdminUser(
  supabaseClient: SupabaseClient,
  userId: string,
  userEmail?: string | null,
): Promise<boolean> {
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (profile?.is_admin === true) return true
  if (userEmail && ADMIN_EMAILS.includes(userEmail)) return true
  return false
}
