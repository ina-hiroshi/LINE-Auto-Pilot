-- スタッフシフトを複数時間枠に対応させる
ALTER TABLE staff_work_patterns
ADD COLUMN slots JSONB DEFAULT '[]'::jsonb;

-- 既存データを新形式に変換
UPDATE staff_work_patterns
SET slots = jsonb_build_array(
  jsonb_build_object(
    'start', start_time,
    'end', end_time
  )
)
WHERE start_time IS NOT NULL AND end_time IS NOT NULL;

-- 古いカラムを削除する前に、データが正しく移行されたか確認
-- 確認後、以下のコメントを外してカラムを削除できます
-- ALTER TABLE staff_work_patterns DROP COLUMN start_time;
-- ALTER TABLE staff_work_patterns DROP COLUMN end_time;
