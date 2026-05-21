-- staff_work_patterns: slots 列の追加（未適用環境向け）と legacy 列との同期

ALTER TABLE staff_work_patterns
ADD COLUMN IF NOT EXISTS slots JSONB DEFAULT '[]'::jsonb;

-- slots が空または無効な行は legacy 列から slots を再構築
UPDATE staff_work_patterns
SET slots = jsonb_build_array(
  jsonb_build_object(
    'start', to_char(start_time, 'HH24:MI'),
    'end', to_char(end_time, 'HH24:MI')
  )
)
WHERE start_time IS NOT NULL
  AND end_time IS NOT NULL
  AND (
    slots IS NULL
    OR slots = '[]'::jsonb
    OR jsonb_array_length(slots) = 0
  );

-- slots が有効な行は legacy 列を第1枠に同期
UPDATE staff_work_patterns
SET
  start_time = (slots->0->>'start')::time,
  end_time = (slots->0->>'end')::time
WHERE slots IS NOT NULL
  AND jsonb_array_length(slots) > 0
  AND slots->0->>'start' IS NOT NULL
  AND slots->0->>'end' IS NOT NULL;
