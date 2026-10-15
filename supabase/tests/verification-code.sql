-- マイグレーション適用済みのテストDBで実行する。データは残さない。
begin;
do $$
declare
  target text := gen_random_uuid()::text || '@example.invalid';
  ip text := gen_random_uuid()::text;
  result text;
  used integer;
begin
  insert into public.verification_codes(email, code, expires_at)
  values (target, '123456', now() + interval '15 minutes');
  for i in 1..5 loop
    result := public.consume_verification_code(target, '654321', ip);
    if result <> 'invalid' then raise exception 'wrong code accepted: %', result; end if;
  end loop;
  result := public.consume_verification_code(target, '123456', ip);
  if result <> 'locked' then raise exception 'five-attempt lock failed: %', result; end if;
  select attempts into used from public.verification_codes where email = target;
  if used <> 5 then raise exception 'attempt count incorrect: %', used; end if;

  update public.verification_codes set verified = true where email = target;
  insert into public.verification_codes(email, code, expires_at)
  values (target, '234567', now() + interval '15 minutes');
  result := public.consume_verification_code(target, '234567', ip);
  if result <> 'success' then raise exception 'valid code failed: %', result; end if;
  result := public.consume_verification_code(target, '234567', ip);
  if result <> 'invalid' then raise exception 'replay accepted: %', result; end if;

  insert into public.verification_codes(email, code, expires_at)
  values (target, '345678', now() - interval '1 second');
  result := public.consume_verification_code(target, '345678', ip);
  if result <> 'invalid' then raise exception 'expired code accepted: %', result; end if;

  -- コードの再送や、送信元IPの変更でもメール単位の枠は消えない。
  for i in 10..30 loop
    perform public.consume_verification_code(target, '000000', ip);
  end loop;
  result := public.consume_verification_code(target, '000000', gen_random_uuid()::text);
  if result <> 'locked' then raise exception 'email rate limit failed: %', result; end if;
  result := public.consume_verification_code(gen_random_uuid()::text, '000000', ip);
  if result <> 'locked' then raise exception 'IP rate limit failed: %', result; end if;

  if has_function_privilege('anon', 'public.consume_verification_code(text,text,text)', 'execute')
    or has_function_privilege('authenticated', 'public.consume_verification_code(text,text,text)', 'execute') then
    raise exception 'public RPC execution allowed';
  end if;
  if not has_function_privilege('service_role', 'public.consume_verification_code(text,text,text)', 'execute') then
    raise exception 'service_role cannot execute RPC';
  end if;
end;
$$;
rollback;
