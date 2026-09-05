-- 自動応答（キーワードルール）。既存 LINE の auto_responses と同じ形
-- （keyword / sub_keywords / response_text / is_active）に、対象プラットフォーム
-- ・アカウントの区別を足しただけ。management は admin-only（他テーブルと同じ）。
create table public.social_auto_reply_rules (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'facebook')),
  account_ref text not null,
  keyword text not null,
  sub_keywords text[] not null default array[]::text[],
  response_text text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_auto_reply_rules enable row level security;

create policy "social_auto_reply_rules_select_admin"
  on public.social_auto_reply_rules
  for select
  to authenticated
  using (public.current_user_is_admin());

-- 1件の受信メッセージに対して自動応答を1回だけ発動させるための門番。
-- unique(conversation_id, message_id) がアプリロジックではなく DB 制約として
-- 「同じ受信メッセージへの二重発動」を防ぐ（social_comment_replies.comment_id
-- と同じ考え方）。ポーリングが5分ごとに全件を再確認しても、この一意制約に
-- ぶつかった行は on conflict do nothing で静かに弾かれる。
create table public.social_auto_reply_hits (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.social_conversations(id) on delete cascade,
  message_id uuid not null references public.social_messages(id) on delete cascade,
  rule_id uuid references public.social_auto_reply_rules(id) on delete set null,
  matched_score integer,
  created_at timestamptz not null default now(),
  unique (conversation_id, message_id)
);

alter table public.social_auto_reply_hits enable row level security;

create policy "social_auto_reply_hits_select_admin"
  on public.social_auto_reply_hits
  for select
  to authenticated
  using (public.current_user_is_admin());

create index social_auto_reply_hits_conversation_id_idx
  on public.social_auto_reply_hits (conversation_id);
