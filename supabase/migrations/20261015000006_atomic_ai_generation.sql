-- 同じ店舗・機能の並列リクエストを直列化し、生成前に試行を記録する。
create or replace function public.reserve_ai_generation(p_store_id uuid, p_feature text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count bigint;
  checked_at timestamptz;
begin
  if p_feature not in ('ai-chat-preview', 'campaign-generator') or p_feature is null then
    raise exception 'Invalid AI generation feature';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':' || p_feature, 0));
  checked_at := clock_timestamp();
  select count(*) into recent_count from public.ai_rate_limits
    where store_id = p_store_id and line_user_id = p_feature
      and created_at >= checked_at - interval '1 hour';
  if recent_count >= 30 then
    return false;
  end if;
  insert into public.ai_rate_limits(store_id, line_user_id, created_at)
    values (p_store_id, p_feature, checked_at);
  return true;
end;
$$;
revoke all on function public.reserve_ai_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_ai_generation(uuid, text) to service_role;
