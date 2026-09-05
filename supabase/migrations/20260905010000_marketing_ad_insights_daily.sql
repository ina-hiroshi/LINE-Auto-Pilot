-- 広告ダッシュボード（/marketing/ads）用の日次キャッシュ。
--
-- 表示のたびに Marketing API を叩くと遅くレート制限にも当たるため、
-- pg_cron で毎日 1 回だけ前日分（と再集計のための直近ウィンドウ）を取り込む。
--
-- unique(ad_id, date) の上に on conflict ... do update を使うこと。
-- Meta の広告成果は attribution window の遡及集計により、確定後も
-- 最大28日分の数値が後から変わりうる。do nothing にすると、確定前に
-- 一度でも取り込んだ日の数値がその後ずっと古いまま固定されてしまう。
create table if not exists public.meta_ad_insights_daily (
  ad_id             text not null,
  date              date not null,
  ad_name           text not null,
  adset_name        text,
  campaign_name     text,
  effective_status  text,
  spend             numeric not null default 0,
  impressions       bigint not null default 0,
  reach             bigint not null default 0,
  clicks            bigint not null default 0,
  ctr               numeric,
  cpm               numeric,
  -- Meta Pixel の Lead イベント（frontend/src/pages/MonitorApplication.tsx の
  -- fbq('track','Lead')）に基づく数値。raw の actions 配列も残し、将来
  -- 別のコンバージョンイベントを見たくなったときに再集計できるようにする。
  leads             bigint not null default 0,
  cost_per_lead     numeric,
  actions           jsonb,
  fetched_at        timestamptz not null default now(),
  primary key (ad_id, date)
);

alter table public.meta_ad_insights_daily enable row level security;
-- ポリシーなし = service_role 専用（meta_credentials / social_posts と同じ方針）。
-- 集計値のみで個人情報は含まないが、広告費という運営の内部情報のため
-- 一般ユーザーはもとより店舗オーナーにも公開しない。

create index if not exists meta_ad_insights_daily_date_idx on public.meta_ad_insights_daily (date);
