-- モニター申込の通知メール送信済みフラグ
-- 公開フォームからの申込のため、同じ application_id での通知の重複送信を防ぐ。
ALTER TABLE monitor_applications
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

COMMENT ON COLUMN monitor_applications.notified_at IS '運営への申込通知メールを送信した日時。NULL のあいだのみ送信する（重複・リプレイ送信の防止）';
