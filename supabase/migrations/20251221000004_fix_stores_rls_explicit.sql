-- stores テーブルのRLS設定を再定義（明示的に分離）
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own stores" ON stores;
DROP POLICY IF EXISTS "Users can view their own stores" ON stores;
DROP POLICY IF EXISTS "Users can insert their own stores" ON stores;
DROP POLICY IF EXISTS "Users can update their own stores" ON stores;
DROP POLICY IF EXISTS "Users can delete their own stores" ON stores;

CREATE POLICY "Users can view their own stores" ON stores
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own stores" ON stores
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own stores" ON stores
  FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own stores" ON stores
  FOR DELETE
  USING (owner_id = auth.uid());
