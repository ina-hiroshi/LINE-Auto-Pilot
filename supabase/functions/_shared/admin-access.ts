import { type SupabaseClient } from '@supabase/supabase-js'
import { isAdminUser } from './admin-check.ts'
import { extractBearerToken } from './store-access.ts'

/**
 * 管理者専用 Edge Function に対する認可。
 *
 * 広報セクション（投稿キュー・広告・DM）が触るのは店舗のデータではなく
 * 運営自身の Meta アカウントなので、store_id で絞る requireStoreAccess は使えない。
 * これらの関数はサービスロールで DB を読むため RLS が効かない。呼び出し元が
 * 管理者本人であることを関数側で必ず確かめる。
 *
 * フロントの withAdminOnly はバンドルが全ユーザーに配信される以上、
 * 境界にはならない。境界はここだけ。
 */

export type AdminAccess =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; response: Response }

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
 * 呼び出し元が管理者かを判定する。
 *
 * @param admin サービスロールのクライアント（JWT 検証と profiles の参照に使う）
 */
export async function requireAdmin(
  req: Request,
  admin: SupabaseClient,
  corsHeaders: Record<string, string>,
): Promise<AdminAccess> {
  const deny = (status: number, error: string): AdminAccess => ({
    ok: false,
    response: denyResponse(status, error, corsHeaders),
  })

  // 検証したいトークンを明示的に渡す。getUser() を引数なしで呼ぶ形は
  // クライアント生成時の Authorization ヘッダに暗黙で依存するため、
  // どのトークンで誰を判定しているかがコード上で追えなくなる。
  const token = extractBearerToken(req.headers.get('Authorization'))
  if (!token) return deny(401, 'unauthorized')

  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return deny(401, 'unauthorized')

  // admin-check.ts は jsr: 指定の SupabaseClient 型を要求する。
  // 実体は同じクライアントだが、モジュール指定子が違うと TS 上は別型になるため橋渡しする。
  const adminForCheck = admin as unknown as Parameters<typeof isAdminUser>[0]
  if (!(await isAdminUser(adminForCheck, user.id, user.email))) {
    return deny(403, 'forbidden')
  }

  return { ok: true, userId: user.id, email: user.email ?? null }
}
