-- Instagram のフォロワー数・投稿ごとのいいね・保存・リーチの日次スナップショット。
--
-- Graph API はフォロワー数の過去の値を返さない。毎日1回記録しないと推移が残らないため、
-- pg_cron で social-ig-insights を呼び、その日の値を残す。広報の報告（/koho）は
-- このテーブルを select するだけで済む。
--
-- 日付は日本時間。同じ日に何度動かしても on conflict で上書きし、行は増えない。
-- reach / saved は instagram_business_manage_insights が要る。取れなかった理由は
-- insights_error に残し、値は null のままにする（0 と区別するため）。

create table if not exists public.social_ig_account_daily (
  snapshot_date   date primary key,
  followers_count integer,
  follows_count   integer,
  media_count     integer,
  -- アカウント全体の前日のリーチ（metric_type=total_value）。取れなければ null。
  reach_last_day  integer,
  profile_error   text,
  insights_error  text,
  fetched_at      timestamptz not null default now()
);

create table if not exists public.social_ig_media_daily (
  media_id           text not null,
  snapshot_date      date not null,
  media_product_type text,
  media_type         text,
  permalink          text,
  posted_at          timestamptz,
  like_count         integer,
  comments_count     integer,
  reach              integer,
  saved              integer,
  insights_error     text,
  fetched_at         timestamptz not null default now(),
  primary key (media_id, snapshot_date)
);

create index if not exists social_ig_media_daily_date_idx on public.social_ig_media_daily (snapshot_date);

alter table public.social_ig_account_daily enable row level security;
alter table public.social_ig_media_daily enable row level security;
-- ポリシーなし = service_role 専用（meta_ad_insights_daily / social_posts と同じ方針）。
-- リポジトリは公開なので、anon から読めないことを RLS で守る。

-- 毎日 06:10 JST（21:10 UTC）。前日分のインサイトが出そろったあとに1回だけ動かす。
select cron.schedule(
  'social-ig-insights-daily',
  '10 21 * * *',
  $$
  select net.http_post(
    url := 'https://puzmemsawziykgzmbvyh.supabase.co/functions/v1/social-ig-insights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
