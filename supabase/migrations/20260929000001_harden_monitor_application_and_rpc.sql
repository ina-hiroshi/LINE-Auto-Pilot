-- 1. モニター応募の上限が実際には効いていなかった問題を直す。
--
-- enforce_monitor_application_cap は SECURITY DEFINER ではなかったため、
-- トリガー内の count(*) が呼び出し元の RLS で絞られていた。
-- 未ログインなら 0 件、ログイン済みでも自分の 1 件しか数えず、上限（10店舗）が発動しなかった。
create or replace function public.enforce_monitor_application_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_capacity constant integer := 10;
begin
  perform pg_advisory_xact_lock(hashtext('monitor_applications_cap'));

  select count(*) into v_count
  from public.monitor_applications
  where status <> 'rejected';

  if v_count >= v_capacity then
    -- メッセージ中の MONITOR_CAPACITY_FULL はフロント（Onboarding.tsx）が
    -- 他のエラーと区別するために文字列一致で見る固定マーカー。変更しないこと。
    raise exception 'MONITOR_CAPACITY_FULL: monitor program has reached its % store capacity', v_capacity;
  end if;

  return new;
end;
$$;

-- 2. 未ログインでも応募行を作れてしまう INSERT ポリシーを、本人のみに絞る。
--    応募はオンボーディング中（ログイン後）にしか作られない（Onboarding.tsx）。
drop policy if exists "Anyone can submit monitor application" on public.monitor_applications;

create policy "Users can submit own monitor application"
  on public.monitor_applications
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- 3. 内部処理用の関数を、REST の rpc から誰でも呼べる状態にしない。
--    cleanup_expired_holds は pg_cron（postgres）、cleanup_old_rate_limits は
--    line-webhook（service_role）から呼ばれるので、それ以外の権限は不要。
--    get_store_plan は LIFF（anon）が使うためここでは触らない。
revoke execute on function public.cleanup_expired_holds() from public, anon, authenticated;
revoke execute on function public.delete_expired_holds() from public, anon, authenticated;
revoke execute on function public.cleanup_old_rate_limits() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.cleanup_expired_holds() to service_role;
grant execute on function public.delete_expired_holds() to service_role;
grant execute on function public.cleanup_old_rate_limits() to service_role;

alter function public.cleanup_expired_holds() set search_path = public;
alter function public.delete_expired_holds() set search_path = public;
alter function public.cleanup_old_rate_limits() set search_path = public;
alter function public.handle_new_user() set search_path = public;
