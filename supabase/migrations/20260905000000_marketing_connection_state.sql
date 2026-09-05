-- 広報コンソールの土台: トークン管理 + 設定 + 管理者判定の共通関数。
--
-- 現状トークンは Supabase Secrets に生で置かれているだけで、更新処理も
-- 失効の可視化もどこにも無い。Instagram Login トークンは約60日で失効し
-- （2026-09-03 発行 → 11月2日前後）、切れると再認可以外に復旧手段が無い。
-- ここでは実体（生トークン）は Vault に置き、このテーブルにはメタデータ
-- だけを持たせる（social_cron_secret を Vault に置いた前例を踏襲）。

create table if not exists public.meta_credentials (
  id                     text primary key,          -- 'instagram_login' | 'facebook_page'
  platform               text not null check (platform in ('instagram','facebook')),
  account_ref            text not null,             -- IG user id / Page id
  vault_secret_name      text not null,             -- 生トークンはここには入れない
  token_type             text not null,
  expires_at             timestamptz,               -- IG: now()+expires_in / FB Page: null（無期限）
  data_access_expires_at timestamptz,
  scopes                 text[],
  last_refreshed_at      timestamptz,
  last_checked_at        timestamptz,
  last_error             text,
  status                 text not null default 'active'
                           check (status in ('active','needs_reauth','expired')),
  updated_at             timestamptz not null default now()
);

alter table public.meta_credentials enable row level security;
-- ポリシーなし = service_role 専用（social_posts の前例踏襲）。
-- 生トークンは持たないが、scopes や last_error はアカウント運用の内部情報なので
-- クライアントへの直接公開はしない。SettingsPage は marketing-settings 関数経由で読む。

comment on table public.meta_credentials is
  'IG/FBトークンのメタデータ。生トークンは vault_secret_name が指す Vault シークレットに入る。';
comment on column public.meta_credentials.expires_at is
  'IGは refresh_access_token のたび now()+expires_in を記録。FB Page トークンは無期限のため通常 null。';

-- 広報関連の運用設定。1行だけを想定する単一行テーブル。
-- SOCIAL_AUTOPOST_ENABLED が Supabase Secrets（env）に置かれていて UI から
-- 切り替えられないため、ここへ移す。自動応答の有効化・ドライランの旗も同居させる
-- （どちらも「本番の外部送信を止める・慎重に出す」ための旗という同じ役割のため）。
create table if not exists public.marketing_settings (
  id text primary key default 'global' check (id = 'global'),
  social_autopost_enabled boolean not null default true,
  auto_reply_enabled boolean not null default false,
  -- true の間は実際に送信せず social_outbound_queue に status='dry_run' で
  -- 書くだけにする。自動応答は初稼働時にいきなり実送信させない安全弁。
  auto_reply_dry_run boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.marketing_settings (id) values ('global') on conflict (id) do nothing;
alter table public.marketing_settings enable row level security;
-- ポリシーなし = service_role 専用。

-- Vault シークレットの読み書きを、値をアプリ層（ひいては会話ログ）に
-- 一切晒さずに行うための橋渡し。vault スキーマは PostgREST に公開されて
-- いないため、supabase-js からは直接 vault.decrypted_secrets を読めない。
-- security definer 関数越しに service_role だけへ execute を許可する。
create or replace function public.meta_secret_get(secret_name text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1
$$;

revoke all on function public.meta_secret_get(text) from public, anon, authenticated;
grant execute on function public.meta_secret_get(text) to service_role;

-- 新規作成 or 既存の更新のどちらも1回で済ませる。vault.create_secret は
-- 同名シークレットがあると一意制約違反になるため、まず存在確認する。
create or replace function public.meta_secret_upsert(
  secret_name text,
  secret_value text,
  secret_description text default null
) returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  existing_id uuid;
  result_id uuid;
begin
  select id into existing_id from vault.secrets where name = secret_name;
  if existing_id is null then
    result_id := vault.create_secret(secret_value, secret_name, secret_description);
  else
    perform vault.update_secret(existing_id, secret_value);
    result_id := existing_id;
  end if;
  return result_id;
end;
$$;

revoke all on function public.meta_secret_upsert(text, text, text) from public, anon, authenticated;
grant execute on function public.meta_secret_upsert(text, text, text) to service_role;

-- 管理者判定。useUserFeatures.tsx（クライアント）と _shared/admin-check.ts
-- （Edge Function）に続く3箇所目の複製。DM受信箱など Realtime を使う画面の
-- SELECT ポリシーはクライアント（authenticated ロール）から直接評価される
-- ため、この関数だけは RLS ポリシーの中で使えるよう security definer にする。
-- _shared/admin-check.ts の isAdminUser() と同じロジックに保つこと。
create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  ) or auth.jwt() ->> 'email' = 'sky.voltric424@gmail.com'
$$;

revoke all on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_is_admin() to authenticated;
