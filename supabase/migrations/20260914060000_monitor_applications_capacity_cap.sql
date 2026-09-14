-- モニター施策を先着10店舗限定にする。
--
-- 「残り◯店舗」という訴求文言を景品表示法上の有利誤認なく出すには、実際の
-- 枠数に基づく必要がある。既存の monitor_applications の INSERT ポリシーは
-- WITH CHECK (true) で無制限のため、別レイヤー（トリガー）で上限を強制する。
--
-- 枠の消費基準: status が rejected 以外の全件（却下すれば枠が戻る）。
-- 同時申込のレースコンディション対策は create_reservation_atomic
-- （20260521000002_create_reservation_atomic_exclude_reservation.sql）と同じ
-- pg_advisory_xact_lock + count + raise exception の形を踏襲する。
create or replace function public.enforce_monitor_application_cap()
returns trigger
language plpgsql
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

drop trigger if exists monitor_applications_cap_check on public.monitor_applications;

create trigger monitor_applications_cap_check
before insert on public.monitor_applications
for each row execute function public.enforce_monitor_application_cap();
