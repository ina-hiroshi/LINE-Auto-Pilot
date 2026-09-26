-- DM 自動応答に「AI応答（LINE の AI 学習データを参照）」を足すための土台。
--
-- キーワード自動応答は既に本番送信中（auto_reply_enabled=true / dry_run=false）の
-- ため、AI 応答はこのマイグレーション適用・関数デプロイの時点では一切動かない
-- 形にする。ai_reply_enabled=false が既定で、さらにオンにしても最初は
-- ai_reply_dry_run=true（記録のみ）から始まる。全体の dry_run は既に false
-- なので、AI 専用の安全弁が無いとオンにした瞬間に実送信されてしまう。

alter table public.marketing_settings
  add column if not exists ai_reply_enabled boolean not null default false,
  add column if not exists ai_reply_dry_run boolean not null default true,
  -- どの店舗の knowledge_base / ai_settings を使うか。cron（social-dm-poll）には
  -- ログインユーザーが居ないため、ここに持たせる。値は marketing-settings が
  -- 呼び出した管理者自身の店舗で埋める（特定の店舗 ID をここに書かない）。
  add column if not exists knowledge_store_id uuid references public.stores(id) on delete set null;

-- 'ai_auto' = social-dm-poll が AI で生成して自動で積んだ返信。
-- 人が承認して送る 'ai_draft_approved' とは区別する。
alter table public.social_outbound_queue
  drop constraint if exists social_outbound_queue_sent_by_check;
alter table public.social_outbound_queue
  add constraint social_outbound_queue_sent_by_check
  check (sent_by in ('manual', 'ai_draft_approved', 'keyword_rule', 'private_reply', 'ai_auto'));
