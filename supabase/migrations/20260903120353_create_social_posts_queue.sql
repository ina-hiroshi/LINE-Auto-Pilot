create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  caption text not null,
  image_urls text[] not null,
  sort_order integer not null,
  status text not null default 'pending' check (status in ('pending','publishing','posted','failed')),
  ig_media_id text,
  permalink text,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create index if not exists social_posts_status_sort_idx
  on public.social_posts (status, sort_order);

alter table public.social_posts enable row level security;
-- No policies: only the service_role (used by the Edge Function) can access this table.

create or replace function public.claim_next_social_post()
returns public.social_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.social_posts;
begin
  update public.social_posts
  set status = 'publishing', attempts = attempts + 1
  where id = (
    select id from public.social_posts
    where status = 'pending'
    order by sort_order asc
    limit 1
    for update skip locked
  )
  returning * into claimed;

  return claimed;
end;
$$;

revoke all on function public.claim_next_social_post() from public, anon, authenticated;
grant execute on function public.claim_next_social_post() to service_role;
