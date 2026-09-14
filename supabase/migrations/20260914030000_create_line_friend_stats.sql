-- LINE公式アカウントの友だち数を日次で記録する。
--
-- Instagram広告経由のLP改修（frontend/src/pages/MonitorApplication.tsx）の
-- 効果測定に、Meta Leadイベント・Supabase応募実績と並ぶ指標として使う
-- （現状はLeadもSupabase応募も0件が続いており、友だち追加自体が増えて
-- いるかどうかを別の角度で確認する必要があるため）。
--
-- LINEのInsight API（GET /v2/bot/insight/followers）は「前日時点」の
-- 確定値を返す仕様で、直近の値は後から遡って修正されることがあるため、
-- unique制約 + on conflict do update で日次スナップショットを上書きする
-- 方式にする（meta_ad_insights_daily と同じ理由）。
create table if not exists public.line_friend_stats (
  line_account_id uuid not null references public.line_accounts(id) on delete cascade,
  store_id        uuid not null references public.stores(id) on delete cascade,
  date            date not null,
  followers       integer,
  target_reaches  integer,
  blocks          integer,
  fetched_at      timestamptz not null default now(),
  primary key (line_account_id, date)
);

create index if not exists line_friend_stats_store_date_idx
  on public.line_friend_stats (store_id, date);

alter table public.line_friend_stats enable row level security;

-- 閲覧は自店舗のみ。書き込みはservice_role専用（sync-line-friend-count経由）。
create policy "Users can view their store line friend stats"
  on public.line_friend_stats for select
  using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );
