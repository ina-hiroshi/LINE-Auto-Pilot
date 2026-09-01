-- google-auth Edge Function の OAuth state 検証を、偽造可能な user.id ベースから
-- サーバー側で発行・保管する単発ナンスに置き換えるためのテーブル。
--
-- 従来は state に user.id をそのまま埋め込み、POST（コード交換）側でも
-- state === user.id を見るだけだった。しかし state はリダイレクトURLの
-- クエリパラメータとして攻撃者が自由に組み立てられる値であり、
-- 「攻撃者が自分のGoogleアカウントで認可を取り、state だけ被害者の
-- user.id に差し替えたURLを被害者に踏ませる」という形で通過してしまう
-- （user.id 自体は推測・入手されうる前提を置くべきではない）。
--
-- 代わりに、認可URL発行(GET)時にサーバーが crypto.randomUUID() を生成して
-- この表に自分のuser_id宛てに保存し、それを state として使う。
-- コード交換(POST)時は「現在の認証ユーザー自身の行」に保存された値との
-- 完全一致のみを受理し、使用後は必ず削除する（単発利用・使い回し不可）。
-- 攻撃者が発行した state は攻撃者自身の user_id 宛てにしか保存されない
-- ため、被害者のセッションでの照合では一致しない。

create table public.google_oauth_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text not null,
  created_at timestamptz not null default now()
);

alter table public.google_oauth_states enable row level security;

create policy "Users can manage their own oauth state"
  on public.google_oauth_states
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
