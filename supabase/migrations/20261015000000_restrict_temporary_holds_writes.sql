-- 仮押さえの作成・変更・削除は認可を行う Edge Function に限定する。
drop policy if exists "Users can manage their own holds" on public.temporary_holds;
revoke insert, update, delete, truncate, references, trigger
  on public.temporary_holds from anon, authenticated;

-- SECURITY DEFINER の期限切れ削除も公開クライアントから実行させない。
revoke execute on function public.delete_expired_holds() from public, anon, authenticated;
grant execute on function public.delete_expired_holds() to service_role;
