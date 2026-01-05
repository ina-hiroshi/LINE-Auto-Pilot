-- 設定代行サービスの注文テーブル
CREATE TABLE IF NOT EXISTS setup_service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  
  -- 決済情報
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT,
  amount INTEGER DEFAULT 9980,
  paid_at TIMESTAMPTZ,
  
  -- ステータス管理
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'in_progress', 'completed', 'cancelled')),
  
  -- 顧客情報
  contact_phone TEXT,
  contact_email TEXT,
  preferred_contact_time TEXT, -- '平日午前', '平日午後', '土日祝' など
  
  -- LINE アカウント情報
  has_line_account BOOLEAN DEFAULT false, -- 既に持っているか
  line_account_basic_id TEXT, -- Basic ID（持っている場合）
  additional_notes TEXT, -- その他要望
  
  -- 作業メモ（管理者用）
  admin_notes TEXT,
  assigned_to TEXT, -- 担当者名
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_setup_orders_user_id ON setup_service_orders(user_id);
CREATE INDEX idx_setup_orders_status ON setup_service_orders(status);
CREATE INDEX idx_setup_orders_created_at ON setup_service_orders(created_at DESC);

-- RLS有効化
ALTER TABLE setup_service_orders ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の注文のみ閲覧可能
CREATE POLICY "Users can view own orders" ON setup_service_orders 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- ユーザーは自分の注文のみ作成可能
CREATE POLICY "Users can create own orders" ON setup_service_orders 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分の注文のみ更新可能（キャンセル用）
CREATE POLICY "Users can update own orders" ON setup_service_orders 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- 管理者権限の追加（profiles テーブルに is_admin カラム追加）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 管理者は全ての注文を閲覧・更新可能
CREATE POLICY "Admins can view all orders" ON setup_service_orders 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update all orders" ON setup_service_orders 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_setup_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER setup_orders_updated_at
  BEFORE UPDATE ON setup_service_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_setup_orders_updated_at();

-- コメント
COMMENT ON TABLE setup_service_orders IS 'LINE公式アカウント設定代行サービスの注文管理';
COMMENT ON COLUMN setup_service_orders.status IS 'pending: 未決済, paid: 決済済み, in_progress: 作業中, completed: 完了, cancelled: キャンセル';
COMMENT ON COLUMN profiles.is_admin IS '管理者フラグ（設定代行スタッフなど）';
