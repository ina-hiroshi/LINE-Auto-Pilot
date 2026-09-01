// 廃止: send-line-message に統合された。
//
// 実際にデプロイされているコードを取得して確認したところ、この関数は
// messageLogId から customer_logs.store_id を引いた後、その店舗が
// 呼び出し元の所有店舗かどうかを一切確認せずに、その店舗のLINE公式
// アカウントでメッセージを送信していた。
//
// つまり、この SaaS の認証済みユーザーであれば誰でも（自分がどの店舗も
// 持っていなくても）、他人の messageLogId さえ分かれば、無関係な店舗の
// LINE公式アカウントから任意のメッセージをその店舗の顧客に送りつけ、
// customer_logs を書き換えられる状態だった。messageLogId は推測困難な
// UUID だが、所有権確認が無いこと自体が構造的な欠陥である。
//
// フロントエンドのどこからもこの関数を呼んでいる箇所は無い
// （grep で確認済み）。店舗所有者を正しく検証する後継の
// send-line-message が既にあるため、本体は復元せず、呼ばれても
// 何もしない 410 を返すだけにする。
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({ error: 'This endpoint has been removed. Use send-line-message instead.' }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
