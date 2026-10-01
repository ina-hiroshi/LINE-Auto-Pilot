-- 手動で行う広報施策（X の手動投稿、Instagram の攻めDM）の台帳。
-- 本文・送付先・注意点を広報画面で見られるようにし、実施したら done_at を付ける。
--
-- 送付先は第三者のアカウントと個別の営業文面を含むため、リポジトリ（公開）には
-- 置かずこのテーブルにだけ持つ。データはマイグレーションに書かず、SQL で直接投入する。
create table public.marketing_outreach_items (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('x', 'instagram')),
  -- action: チェックを付ける対象（X の投稿1本、DM 1件）
  -- guide : 方針・ルール・テンプレートなど読むだけの情報
  kind text not null check (kind in ('action', 'guide')),
  section text not null default '',
  sort_order integer not null default 0,
  title text not null,
  target_handle text,
  target_name text,
  target_detail text,
  body text not null default '',
  note text,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_outreach_items_channel_order_idx
  on public.marketing_outreach_items (channel, sort_order);

alter table public.marketing_outreach_items enable row level security;

-- 管理者だけが読み、実施済みのチェックと本文の手直しができる。
-- 追加・削除は画面からは行わない（SQL で投入する）。
create policy "marketing_outreach_items_select_admin"
  on public.marketing_outreach_items
  for select
  to authenticated
  using (public.current_user_is_admin());

create policy "marketing_outreach_items_update_admin"
  on public.marketing_outreach_items
  for update
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
