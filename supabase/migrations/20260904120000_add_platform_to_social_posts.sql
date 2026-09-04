-- Support cross-posting the same slug to multiple platforms (instagram, facebook).
-- Each (slug, platform) pair becomes its own queue row so Instagram and Facebook
-- publishing can succeed/fail/retry independently while sharing one creative slug.

alter table public.social_posts
  add column if not exists platform text not null default 'instagram'
    check (platform in ('instagram', 'facebook'));

-- fb_media_id/permalink reuse the existing ig_media_id/permalink columns' shape,
-- but Facebook posts have distinct ids from Instagram media ids, so give them
-- their own column instead of overloading ig_media_id.
alter table public.social_posts
  rename column ig_media_id to platform_media_id;

alter table public.social_posts drop constraint if exists social_posts_slug_key;
alter table public.social_posts
  add constraint social_posts_slug_platform_key unique (slug, platform);

drop index if exists social_posts_status_sort_idx;
create index if not exists social_posts_status_sort_idx
  on public.social_posts (status, sort_order);

-- Claim every pending row for the next slug (across all its platforms) in one
-- shot so a single cron tick can publish the same creative to Instagram and
-- Facebook together, instead of draining one platform at a time.
drop function if exists public.claim_next_social_post();

create or replace function public.claim_next_social_post_batch()
returns setof public.social_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  target_slug text;
begin
  select slug into target_slug
  from public.social_posts
  where status = 'pending'
  order by sort_order asc
  limit 1;

  if target_slug is null then
    return;
  end if;

  return query
  update public.social_posts
  set status = 'publishing', attempts = attempts + 1
  where id in (
    select id from public.social_posts
    where slug = target_slug and status = 'pending'
    for update skip locked
  )
  returning *;
end;
$$;

revoke all on function public.claim_next_social_post_batch() from public, anon, authenticated;
grant execute on function public.claim_next_social_post_batch() to service_role;
