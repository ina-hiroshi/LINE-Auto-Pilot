-- stores は anon に USING (true) の SELECT ポリシーがあり、店舗を絞る条件が無かった。
-- 実際に anon キーだけで /rest/v1/stores?select=id,name を叩き、全店舗の名前・IDを
-- 列挙できることを確認した（列自体は以前の migration で owner_id/住所/電話番号を
-- 除外済みだが、行は全店舗ぶん見えていた）。
--
-- 読み手は Booking.tsx / MemberCardLIFF.tsx（LIFF公開画面）のみで、
-- 直前のコミットで booking Edge Function の get_store_public_info
-- （store_id 必須・サービスロールで店舗ごとに絞って返す）経由に切り替え済み。
-- Edge Function のデプロイと Vercel への本番反映を確認した上でこの移行を適用する。
--
-- 他の Edge Function（get-admin-data 等）は service_role クライアントで
-- stores を読んでおり、create-setup-checkout は authenticated ロールの
-- JWT が無ければ早期に失敗するため、いずれもこの anon ポリシーには
-- 依存していないことを確認済み。
--
-- 店舗管理画面（authenticated）向けのポリシーはそのまま残す。

drop policy if exists "Public read access to stores" on public.stores;
