-- マイグレーション適用済みのローカルテストDBで実行する。変更は残さない。
begin;
do $$
declare
  first_user uuid := gen_random_uuid();
  second_user uuid := gen_random_uuid();
  allowed boolean;
begin
  insert into auth.users (id) values (first_user), (second_user);
  perform set_config('request.jwt.claim.sub', first_user::text, true);
  for i in 1..10 loop
    if not public.consume_url_fetch_quota() then raise exception 'quota rejected request %', i; end if;
  end loop;
  if public.consume_url_fetch_quota() then raise exception 'eleventh request accepted'; end if;
  perform set_config('request.jwt.claim.sub', second_user::text, true);
  if not public.consume_url_fetch_quota() then raise exception 'users share quota'; end if;
  perform set_config('request.jwt.claim.sub', first_user::text, true);
  update public.url_fetch_quotas set window_start = date_trunc('minute', clock_timestamp()) - interval '1 minute'
    where user_id = first_user;
  if not public.consume_url_fetch_quota() then raise exception 'quota did not reset'; end if;
  if (select request_count from public.url_fetch_quotas where user_id = first_user) <> 1 then
    raise exception 'reset count is incorrect';
  end if;
  if has_table_privilege('authenticated', 'public.url_fetch_quotas', 'INSERT')
    or has_table_privilege('authenticated', 'public.url_fetch_quotas', 'UPDATE')
    or has_table_privilege('authenticated', 'public.url_fetch_quotas', 'DELETE')
    or has_function_privilege('anon', 'public.consume_url_fetch_quota()', 'EXECUTE') then
    raise exception 'quota permissions are too broad';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    allowed := public.consume_url_fetch_quota();
    raise exception 'unauthenticated quota call succeeded: %', allowed;
  exception when others then
    if sqlerrm not like '%Authentication required%' then raise; end if;
  end;
end;
$$;
rollback;
