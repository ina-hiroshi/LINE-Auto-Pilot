-- staff_work_patterns テーブルの start_time と end_time を NULLABLE に変更
-- slots カラム（JSONB）で複数時間枠を管理するため、古いカラムは不要

ALTER TABLE staff_work_patterns 
ALTER COLUMN start_time DROP NOT NULL;

ALTER TABLE staff_work_patterns 
ALTER COLUMN end_time DROP NOT NULL;

-- 古いカラムにダミー値を入れる必要がなくなるため、NULLを許可
-- slots カラムが主要なデータソースになる
