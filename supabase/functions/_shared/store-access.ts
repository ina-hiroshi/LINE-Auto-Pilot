import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isAdminUser } from './admin-check.ts'

/**
 * 店舗単位の Edge Function に対する認可。
 *
 * これらの関数はサービスロールで DB を読むため、RLS が効かない。
 * 呼び出し元が「その店舗のオーナー本人」か「管理者」であることを
 * 関数側で必ず確かめないと、store_id を差し替えるだけで
 * 他店舗のデータを読んだり設定を書き換えたりできてしまう。
 */

export type StoreAccess =
  | { ok: true; userId: string; isAdmin: boolean }
  | { ok: false; response: Response }

export type StoreAccessOptions = {
  /** ストアが存在しない場合に返すステータス（既定 404） */
  notFoundStatus?: number
}

function denyResponse(
  status: number,
  error: string,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * 呼び出し元が storeId の店舗を操作してよいかを判定する。
 *
 * @param admin サービスロールのクライアント（stores / profiles の参照に使う）
 */
export async function requireStoreAccess(
  req: Request,
  storeId: string,
  admin: SupabaseClient,
  corsHeaders: Record<string, string>,
  options: StoreAccessOptions = {},
): Promise<StoreAccess> {
  const deny = (status: number, error: string): StoreAccess => ({
    ok: false,
    response: denyResponse(status, error, corsHeaders),
  })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return deny(401, 'Unauthorized')

  // 呼び出し元の JWT でユーザーを解決する。
  // anon キーをそのまま渡された場合は sub を持たないので user は得られない。
  const caller = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: userError } = await caller.auth.getUser()
  if (userError || !user) return deny(401, 'Unauthorized')

  const { data: store } = await admin
    .from('stores')
    .select('owner_id')
    .eq('id', storeId)
    .maybeSingle()

  if (!store) return deny(options.notFoundStatus ?? 404, 'Store not found')

  if (store.owner_id === user.id) {
    return { ok: true, userId: user.id, isAdmin: false }
  }

  // 代行セットアップのため、管理者は他店舗も操作できる。
  // admin-check.ts は jsr: 指定の SupabaseClient 型を要求する。
  // 実体は同じクライアントだが、モジュール指定子が違うと TS 上は別型になるため橋渡しする。
  const adminForCheck = admin as unknown as Parameters<typeof isAdminUser>[0]
  if (await isAdminUser(adminForCheck, user.id, user.email)) {
    return { ok: true, userId: user.id, isAdmin: true }
  }

  return deny(403, 'Forbidden')
}
