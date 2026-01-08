-- メール送信済みフラグを追加（冪等性を保つため）
ALTER TABLE setup_service_orders 
ADD COLUMN IF NOT EXISTS payment_confirmation_email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completion_email_sent_at TIMESTAMPTZ;

-- コメント
COMMENT ON COLUMN setup_service_orders.payment_confirmation_email_sent_at IS '決済確認メール送信日時（重複送信を防ぐため）';
COMMENT ON COLUMN setup_service_orders.completion_email_sent_at IS '完了メール送信日時（重複送信を防ぐため）';
