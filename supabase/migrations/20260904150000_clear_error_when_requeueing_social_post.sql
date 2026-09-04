-- Keep `error` meaningful as a triage signal.
--
-- Recovering a stranded row put it back to 'pending' while leaving the previous
-- attempt's message in `error`, so a queued-and-healthy row could still look
-- broken. Clear the message whenever a row goes back into the queue; only rows
-- that actually gave up keep one. `error is not null` then means exactly
-- "status = 'failed'".

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
        when attempts < max_attempts then null
        else 'stranded in publishing (likely edge function timeout)'
      end
  where status = 'publishing'
    and claimed_at is not null
    and claimed_at < now() - stale_after;

  -- Oldest slug that still has work left on any platform. Failed rows stay
  -- eligible until the attempt cap so a transient API error self-heals on the
  -- next tick; past the cap they drop out and stop blocking later slugs.
  -- Rows already 'posted' are excluded by status, so a platform that succeeded
  -- never spends attempts on behalf of the one still retrying.
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
