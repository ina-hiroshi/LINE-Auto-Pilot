-- LINE Login の userId と Messaging API の userId は別。プッシュは Messaging 側の userId が必要。
-- 予約時は Login ID のみ分かるため、ユーザーが公式トークで「連携XXXXXXXX」と送ったときに紐づける。

alter table public.customers
  add column if not exists line_messaging_user_id text;

comment on column public.customers.line_messaging_user_id is '店舗の Messaging API ボット宛の userId（プッシュ用）。LINE Login の line_user_id とは別。';

create unique index if not exists customers_store_messaging_uid_unique
  on public.customers (store_id, line_messaging_user_id)
  where line_messaging_user_id is not null;

create table if not exists public.line_messaging_link_tokens (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  login_line_user_id text not null,
  token char(8) not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (token),
  unique (store_id, login_line_user_id)
);

comment on table public.line_messaging_link_tokens is 'LINE Login ID と Messaging userId を紐づけるワンタイムトークン（予約通知プッシュ用）';

alter table public.line_messaging_link_tokens enable row level security;
-- anon/authenticated はポリシーなしで拒否。Edge Function の service_role は RLS をバイパス。
