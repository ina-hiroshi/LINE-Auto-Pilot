-- create_reservation_atomic は SECURITY DEFINER の PL/pgSQL 関数で、LINE トークン検証・
-- 過去日時チェック・受付期間チェックのいずれも行わず、渡された store_id / line_user_id /
-- 時間帯でそのまま status='confirmed' の予約を作成する。
-- Postgres の CREATE FUNCTION は明示的な REVOKE が無い限り PUBLIC に EXECUTE を許可するため、
-- PostgREST 経由で anon / authenticated が /rest/v1/rpc/create_reservation_atomic を
-- 直接叩けてしまっていた。
--
-- 実際に公開されている anon キーだけでこの RPC を呼び、実店舗（IToguchi）に
-- LINEログイン無しで確定予約を作成できることを確認した（検証用の行は直後に削除済み）。
-- これは booking Edge Function が行っている LINE 認証・入力検証をすべて
-- 迂回できる経路であり、任意店舗のカレンダーを架空予約で埋められる／
-- 荒らされる状態だった。
--
-- 呼び出し元は booking Edge Function（サービスロールクライアント）のみで、
-- service_role は既に独自の EXECUTE 権限を持つため、anon / authenticated /
-- public から剥がしても既存の予約作成フローに影響しない。

revoke execute on function public.create_reservation_atomic(
  uuid, uuid, text, timestamptz, timestamptz, uuid, uuid, text, text, integer, uuid
) from public;

revoke execute on function public.create_reservation_atomic(
  uuid, uuid, text, timestamptz, timestamptz, uuid, uuid, text, text, integer, uuid
) from anon;

revoke execute on function public.create_reservation_atomic(
  uuid, uuid, text, timestamptz, timestamptz, uuid, uuid, text, text, integer, uuid
) from authenticated;
