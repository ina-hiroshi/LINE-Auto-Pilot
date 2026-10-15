-- 未認証APIの照合と試行枠の消費を同じトランザクションで行う。
create table public.verification_attempt_limits (
  key text primary key,
  window_started_at timestamptz not null,
  attempts integer not null
);
alter table public.verification_attempt_limits enable row level security;

create or replace function public.consume_verification_code(p_email text, p_code text, p_ip text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  pending public.verification_codes%rowtype;
  limit_key text;
  used integer;
  matches boolean := true;
  i integer;
begin
  -- 全呼び出しでIP→メールの順にロックし、並列要求も回数に数える。
  foreach limit_key in array array['ip:' || coalesce(p_ip, 'unknown'), 'email:' || lower(trim(p_email))] loop
    insert into public.verification_attempt_limits as limits(key, window_started_at, attempts)
    values (limit_key, now(), 1)
    on conflict (key) do update set
      attempts = case when limits.window_started_at <= now() - interval '15 minutes' then 1 else limits.attempts + 1 end,
      window_started_at = case when limits.window_started_at <= now() - interval '15 minutes' then now() else limits.window_started_at end
    returning attempts into used;
    if used > 30 then return 'locked'; end if;
  end loop;

  select * into pending from public.verification_codes
  where email = lower(trim(p_email)) and verified = false and expires_at > now()
  order by created_at desc, id desc limit 1 for update;
  if not found then return 'invalid'; end if;
  if pending.attempts >= 5 then return 'locked'; end if;

  update public.verification_codes set attempts = attempts + 1 where id = pending.id;
  -- 途中で打ち切らず、6文字すべてを比較する。
  matches := length(p_code) = 6 and length(pending.code) = 6;
  for i in 1..6 loop
    if substr(p_code, i, 1) <> substr(pending.code, i, 1) then matches := false; end if;
  end loop;
  if not matches then return 'invalid'; end if;
  update public.verification_codes set verified = true where id = pending.id;
  return 'success';
end;
$$;
revoke all on function public.consume_verification_code(text, text, text) from public, anon, authenticated;
grant execute on function public.consume_verification_code(text, text, text) to service_role;
