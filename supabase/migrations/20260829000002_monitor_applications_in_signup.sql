-- モニター申込を登録フローの中で受け取れるようにする。
--
-- 背景: 申込フォームが新規登録と別窓口だったため、申込者は user_id を持たず、
-- 設定代行（setup_service_orders.user_id が NOT NULL）に引き渡せなかった。
-- 申込を登録フロー内（プラン選択時のインタビュー協力の同意）へ移すことで、
-- 申込の時点で user_id が確定する。
--
-- あわせて特典を「初期設定代行 ¥9,980 無料」の1本に統一する。
-- 「Proプラン初月無料」は全ユーザーに適用される 30 日トライアルと同一で、
-- 特典として上乗せがなかった。「3ヶ月無料」は付与手段が実装されていなかった。
-- そのため course（omakase / jikkuri）の区別自体が不要になる。

-- 登録フロー内からの申込は user_id を持つ。
-- 既存の登録前レコードは NULL のままなので NOT NULL にはしない。
ALTER TABLE monitor_applications
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN monitor_applications.user_id IS
  '登録フロー内で申し込んだ場合の申込者。旧フォーム（登録前）からの申込は NULL。';

-- 1ユーザーが二重に申し込むのを防ぐ。
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitor_applications_user
  ON monitor_applications(user_id)
  WHERE user_id IS NOT NULL;

-- コース選択を廃止するため、course を任意にする。
-- 既存レコードの値は履歴として残す。
ALTER TABLE monitor_applications ALTER COLUMN course DROP NOT NULL;

ALTER TABLE monitor_applications DROP CONSTRAINT IF EXISTS monitor_applications_course_check;
ALTER TABLE monitor_applications
  ADD CONSTRAINT monitor_applications_course_check
  CHECK (course IS NULL OR course IN ('omakase', 'jikkuri'));

COMMENT ON COLUMN monitor_applications.course IS
  '旧コース選択（omakase / jikkuri）。2026-08-29 に特典を初期設定代行無料の1本へ統一したため、新規申込では NULL。';

-- 本人が自分の申込を作成・参照できるようにする。
-- 既存の "Anyone can submit monitor application" は登録前フォーム用に残す。
DROP POLICY IF EXISTS "Users can view own monitor application" ON monitor_applications;
CREATE POLICY "Users can view own monitor application" ON monitor_applications
  FOR SELECT
  USING (auth.uid() = user_id);
