// 廃止: 期限切れ仮予約(temporary_holds)のDBレコード削除は
// pg_cron が毎分呼んでいる public.cleanup_expired_holds() (SQL関数、
// migrations参照) が既に担っている。
//
// この Edge Function は config.toml で verify_jwt = false となっており、
// 未認証で誰でも呼び出せる状態のまま本番で稼働していた。呼び出されると
// service role 権限で全店舗の temporary_holds を横断的に削除し、各店舗の
// Google Calendar の認証情報(refresh_token)を使ってアクセストークンを
// 発行し、Googleカレンダー上のイベントを削除するという、実際に外部API
// を叩く副作用のある処理を行っていた。
//
// リクエストボディを一切読まず、操作対象も「既に期限切れ」のレコードに
// 限られるため、任意のデータを書き換えられるような直接的な脆弱性では
// ないが、「本番で本当に稼働している、認可の一切ないエンドポイントが
// service role 権限で実処理を行う」構図は、今回 admin-set-user-plan /
// manual-reply で実際に重大な穴として見つかったものと同じ形であり、
// フロントエンド・他のEdge Function・pg_cron・Vercel cron のいずれから
// も呼ばれていない(grep で確認済み)ことから、攻撃対象を減らすために
// 無効化する。
//
// なお、期限切れ仮予約に紐づくGoogleカレンダーイベントの削除は、この
// 関数を無効化する前から実質的に行われていなかった(呼び出し元が存在
// しなかったため)。pg_cron 側のDB削除だけでは Google Calendar 上の
// イベントは残り続けるため、必要であれば別途、認可された経路での
// クリーンアップの仕組みを検討すること。
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({ error: 'This endpoint has been removed. Expired holds are cleaned up by a scheduled database job.' }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
