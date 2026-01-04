-- 予約の登録種別カラムを追加 (LINE予約 / 手動登録)
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'line';

-- コメントを追加
COMMENT ON COLUMN reservations.registration_type IS '登録種別: line (LINE予約), manual (手動登録)';
