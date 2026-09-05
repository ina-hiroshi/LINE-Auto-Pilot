-- DM 受信箱（task #9）の正規化テーブル。
--
-- ポーリング（/me/conversations + /conversations/{id}/messages）を先に実装し、
-- webhook は後から同じテーブルに載せる（advisor 方針）。そのため dedupe_key は
-- 「webhook のリアクション等が親メッセージの mid を再利用しても衝突しない」
-- 形にしておく。ポーリングでは dedupe_key = mid をそのまま使う。
--
-- LINE 実装の反省点（表示名での名寄せをせず、IGSID/PSID は別空間のまま扱う）を
-- 踏まえ、person_id は将来の手動名寄せ用の nullable 列としてのみ置き、
-- 自動統合ロジックは書かない。

create table public.social_identities (
  id                 uuid primary key default gen_random_uuid(),
  platform           text not null check (platform in ('instagram', 'facebook')),
  account_ref        text not null, -- 自社側 IG business account id / Page id
  external_id        text not null, -- 相手側 IGSID / PSID
  person_id          uuid,          -- 将来の手動名寄せ用。自動では埋めない。
  display_name       text,
  profile_pic_url    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (platform, account_ref, external_id)
);

create table public.social_conversations (
  id                       uuid primary key default gen_random_uuid(),
  platform                 text not null check (platform in ('instagram', 'facebook')),
  account_ref              text not null,
  external_conversation_id text not null,
  identity_id              uuid not null references public.social_identities(id),
  -- メッセージングウィンドウ判定の唯一の情報源。受信メッセージだけが更新してよい。
  -- 送信・echo は絶対にここを触らない（自動応答フェーズで強制する）。
  last_inbound_at          timestamptz,
  last_message_at          timestamptz,
  -- ポーリングの高水位。会話ごとの updated_time で絞り込み、履歴を毎回全走査しない。
  last_polled_at           timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (platform, account_ref, external_conversation_id)
);
create index social_conversations_last_message_at_idx on public.social_conversations (last_message_at desc);

create table public.social_messages (
  id                    uuid primary key default gen_random_uuid(),
  conversation_id       uuid not null references public.social_conversations(id),
  external_message_id   text not null, -- mid
  -- webhook 導入後、リアクション等は親メッセージの mid を再利用するため
  -- mid 単体では冪等にならない。ポーリングでは dedupe_key = mid。
  dedupe_key            text not null,
  direction             text not null check (direction in ('inbound', 'outbound', 'echo')),
  message_type          text not null default 'text'
                           check (message_type in ('text', 'image', 'story_reply', 'story_reaction', 'reaction', 'other')),
  text                  text,
  attachments           jsonb,
  raw                   jsonb not null, -- 正規化がずれていた場合の再取り込み用に生ペイロードを必ず残す
  occurred_at           timestamptz not null,
  created_at            timestamptz not null default now(),
  unique (conversation_id, dedupe_key)
);
create index social_messages_conversation_id_occurred_at_idx on public.social_messages (conversation_id, occurred_at);

create table public.social_outbound_queue (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid not null references public.social_conversations(id),
  idempotency_key    text not null unique,
  recipient          jsonb not null,
  message            jsonb not null,
  -- HUMAN_AGENT タグは 'manual' のときのみ許可（送信経路側で強制。ここは記録のための型）。
  sent_by            text not null check (sent_by in ('manual', 'ai_draft_approved', 'keyword_rule', 'private_reply')),
  status             text not null default 'pending'
                       check (status in ('pending', 'dry_run', 'sent', 'skipped', 'failed')),
  attempts           int not null default 0,
  last_error         text,
  created_at         timestamptz not null default now(),
  sent_at            timestamptz
);

alter table public.social_identities enable row level security;
alter table public.social_conversations enable row level security;
alter table public.social_messages enable row level security;
alter table public.social_outbound_queue enable row level security;

-- 読み取りは管理者のみ。TO authenticated を明示しないと current_user_is_admin() が
-- role 'public' として評価され、anon からの呼び出しが関数呼び出しの時点で失敗する
-- （message_campaigns の前例で踏んだ落とし穴）。
create policy "admin can read social_identities" on public.social_identities
  for select to authenticated using (public.current_user_is_admin());
create policy "admin can read social_conversations" on public.social_conversations
  for select to authenticated using (public.current_user_is_admin());
create policy "admin can read social_messages" on public.social_messages
  for select to authenticated using (public.current_user_is_admin());
create policy "admin can read social_outbound_queue" on public.social_outbound_queue
  for select to authenticated using (public.current_user_is_admin());
-- 書き込みポリシーは無し（service_role 専用。social_posts と同じ扱い）。
