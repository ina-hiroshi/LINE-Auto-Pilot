-- Make the queue survive unattended operation.
--
-- Splitting one slug into per-platform rows introduced two ways for the daily
-- cron to stall silently:
--   1. A row that errors is set to 'failed', but the claim function only looks
--      at 'pending', so that platform is never retried and the slug is posted
--      to one network only.
--   2. Publishing Instagram and Facebook happens inside a single Edge Function
--      invocation. If it hits the wall-clock limit the rows stay 'publishing'
--      forever and every later tick skips them.
-- Both fail without surfacing anything, so recover from them here rather than
-- relying on someone noticing.

-- When the row was moved to 'publishing', so a stranded claim can be detected.
alter table public.social_posts
  add column if not exists claimed_at timestamptz;

-- Retryable rows are looked up by status, so index them alongside sort_order.
drop index if exists social_posts_status_sort_idx;
create index if not exists social_posts_status_sort_idx
  on public.social_posts (status, sort_order);

create or replace function public.claim_next_social_post_batch()
returns setof public.social_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  target_slug text;
  max_attempts constant integer := 3;
  -- The cron runs daily, so anything still 'publishing' after this window
  -- belongs to an invocation that died rather than one still running.
  stale_after constant interval := interval '30 minutes';
begin
  -- Release rows stranded by an invocation that never finished. Past the
  -- attempt cap, park them in 'failed' so they are visible instead of
  -- invisibly stuck in 'publishing'.
  update public.social_posts
  set status = case when attempts < max_attempts then 'pending' else 'failed' end,
      error = case
        when attempts < max_attempts then error
        else 'stranded in publishing (likely edge function timeout)'
      end
  where status = 'publishing'
    and claimed_at is not null
    and claimed_at < now() - stale_after;

  -- Oldest slug that still has work left on any platform. Failed rows stay
  -- eligible until the attempt cap so a transient API error self-heals on the
  -- next tick; past the cap they drop out and stop blocking later slugs.
  select slug into target_slug
  from public.social_posts
  where status = 'pending'
     or (status = 'failed' and attempts < max_attempts)
  order by sort_order asc
  limit 1;

  if target_slug is null then
    return;
  end if;

  return query
  update public.social_posts
  set status = 'publishing',
      attempts = attempts + 1,
      claimed_at = now(),
      error = null
  where id in (
    select id from public.social_posts
    where slug = target_slug
      and (status = 'pending' or (status = 'failed' and attempts < max_attempts))
    for update skip locked
  )
  returning *;
end;
$$;

revoke all on function public.claim_next_social_post_batch() from public, anon, authenticated;
grant execute on function public.claim_next_social_post_batch() to service_role;
