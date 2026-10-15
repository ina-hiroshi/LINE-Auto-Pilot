-- URL 取込はユーザーごとに固定窓で10回/分。並行リクエストも同じ行で直列化する。
create table public.url_fetch_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count between 1 and 10)
);
alter table public.url_fetch_quotas enable row level security;
revoke all on public.url_fetch_quotas from anon, authenticated;

create or replace function public.consume_url_fetch_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  current_window timestamptz := date_trunc('minute', clock_timestamp());
  allowed_user uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  insert into public.url_fetch_quotas as quotas (user_id, window_start, request_count)
  values (caller, current_window, 1)
  on conflict (user_id) do update set
    window_start = excluded.window_start,
    request_count = case when quotas.window_start < excluded.window_start then 1 else quotas.request_count + 1 end
  where quotas.window_start < excluded.window_start or quotas.request_count < 10
  returning user_id into allowed_user;
  return allowed_user is not null;
end;
$$;
revoke all on function public.consume_url_fetch_quota() from public, anon;
grant execute on function public.consume_url_fetch_quota() to authenticated;
