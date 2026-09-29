-- LIFF（予約ページ）と Messaging API（Bot）のユーザー ID を結びつける仕組み。
--
-- LINE のユーザー ID はプロバイダーごとに別の値になる。LIFF の LINE ログインチャネルと
-- 店舗の Messaging API チャネルが別プロバイダーだと、同じお客様でも
--   customers.line_user_id          = LIFF（予約ページ）側の ID
--   customers.line_messaging_user_id = Bot（公式アカウント）側の ID
-- になる。一斉配信は Bot 側の ID でしか届かないため、両方を持つ。
--
-- 紐付けは、予約完了時に LIFF がお客様本人の発言として「確認コード」を Bot へ送り、
-- Webhook がコードから予約側の ID を引いて行う（応答メッセージなので配信数は使わない）。
-- 以前の実装（20260406000000）は 20260407000000 で削除したが、今回は
-- 予約の受付通知（応答メッセージ）とセットで作り直す。

-- 1. 顧客に Bot 側の ID を持たせる
alter table public.customers
  add column if not exists line_messaging_user_id text;

comment on column public.customers.line_messaging_user_id is
  '店舗の Messaging API（Bot）から見たユーザー ID。line_user_id（LIFF 側）とはプロバイダーが違うと別の値になる。配信・返信はこちらを使う。';

create unique index if not exists customers_store_messaging_uid_unique
  on public.customers (store_id, line_messaging_user_id)
  where line_messaging_user_id is not null;

-- 2. 店舗の LIFF 側 ID と Bot 側 ID が同じ体系かどうか。
--    紐付けが成立したときに、両者が一致していれば true、違えば false を入れる。
--    null は未判定（まだ紐付けが 1 件も成立していない）。
--    true の店舗では、紐付け前の顧客にも LIFF 側の ID で配信できる。
alter table public.stores
  add column if not exists line_ids_aligned boolean;

comment on column public.stores.line_ids_aligned is
  'LIFF 側と Bot 側のユーザー ID が同じ体系か。true: 同じプロバイダー / false: 別プロバイダー / null: 未判定。';

-- 3. 紐付けコード（1 回限り・短時間で失効）
create table if not exists public.line_messaging_link_tokens (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  login_line_user_id text not null,
  code text not null,
  kind text not null check (kind in ('created', 'updated', 'cancelled')),
  reservation_id uuid references public.reservations(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (code)
);

comment on table public.line_messaging_link_tokens is
  '予約完了時に LIFF がトークへ送る確認コード。Webhook が受け取って Bot 側 ID を顧客に紐付ける。';

create index if not exists line_messaging_link_tokens_expires_idx
  on public.line_messaging_link_tokens (expires_at);

alter table public.line_messaging_link_tokens enable row level security;
-- anon / authenticated にはポリシーを付けない（拒否）。Edge Function の service_role は RLS をバイパスする。

-- 4. 友だち（Bot 側の ID）の記録。follow / unfollow イベントから更新する。
--    LIFF を通らずに友だち追加しただけの人も、ここには残る。
create table if not exists public.line_friends (
  store_id uuid not null references public.stores(id) on delete cascade,
  messaging_user_id text not null,
  status text not null default 'following' check (status in ('following', 'blocked')),
  followed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, messaging_user_id)
);

comment on table public.line_friends is
  '店舗の公式アカウントの友だち（Bot 側の ID）。follow / unfollow イベントで更新する。記録開始前からの友だちは含まれない。';

alter table public.line_friends enable row level security;
-- ポリシーなし（service_role のみ）。
