// 廃止: admin-update-user-plan に統合された。
//
// 本番にはこの関数のソースが git 管理下に存在しないまま、古いバンドルが
// 稼働し続けていた。取得した実際のデプロイ済みコードを確認したところ、
// _shared/admin-check.ts の isAuthorizedForAdminAnalytics(userId) が
// `return !!userId` — つまり「ログイン済みなら誰でも true」を返す実装で、
// admin-set-user-plan はこれを管理者判定として使っていた。
//
// 結果として、管理者ではない一般の認証済みユーザーが誰でも
// targetUserId と plan を指定するだけで、他人（自分自身を含む）の
// プランを 'executive' 等に直接書き換えられる状態だった。決済も
// 管理者権限も一切不要で、Stripe を完全に迂回できる。
//
// フロントエンドや他の Edge Function からこの関数を呼んでいる箇所は無い
// （grep で確認済み）。正しい認可（isAdminUser）を行う後継の
// admin-update-user-plan が既にあるため、本体は復元せず、
// 呼ばれても何もしない 410 を返すだけにする。
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({ error: 'This endpoint has been removed. Use admin-update-user-plan instead.' }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
