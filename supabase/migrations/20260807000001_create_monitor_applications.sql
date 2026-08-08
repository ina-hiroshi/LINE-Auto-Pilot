-- リリース記念モニター限定特典キャンペーンの申込テーブル
CREATE TABLE IF NOT EXISTS monitor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 申込者情報
  store_name TEXT NOT NULL,
  industry TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  has_line_account BOOLEAN DEFAULT false,
  message TEXT,

  -- コース選択
  course TEXT NOT NULL CHECK (course IN ('omakase', 'jikkuri')), -- omakase: おまかせ導入コース, jikkuri: じっくりお得コース

  -- インタビューフォーム回答への同意（特典の適用条件）
  agreed_to_interview BOOLEAN DEFAULT false NOT NULL,

  -- ステータス管理（管理者用）
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'approved', 'rejected')),
  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monitor_applications_status ON monitor_applications(status);
CREATE INDEX idx_monitor_applications_created_at ON monitor_applications(created_at DESC);

-- RLS有効化
ALTER TABLE monitor_applications ENABLE ROW LEVEL SECURITY;

-- 誰でも申込可能（未ログインの見込み客からの申込を想定した公開フォーム）
CREATE POLICY "Anyone can submit monitor application" ON monitor_applications
  FOR INSERT
  WITH CHECK (true);

-- 管理者は全ての申込を閲覧可能
CREATE POLICY "Admins can view all monitor applications" ON monitor_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- 管理者は全ての申込を更新可能（ステータス変更・メモ追加用）
CREATE POLICY "Admins can update all monitor applications" ON monitor_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_monitor_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monitor_applications_updated_at
  BEFORE UPDATE ON monitor_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_monitor_applications_updated_at();

-- コメント
COMMENT ON TABLE monitor_applications IS 'リリース記念モニター限定特典キャンペーンの申込管理（REQUIREMENTS.md 7章）';
COMMENT ON COLUMN monitor_applications.course IS 'omakase: 初期設定代行無料+Pro初月無料, jikkuri: 初期設定代行支払い+Pro3ヶ月無料';
COMMENT ON COLUMN monitor_applications.status IS 'pending: 未対応, contacted: 連絡済み, approved: 特典適用済み, rejected: 対象外';
