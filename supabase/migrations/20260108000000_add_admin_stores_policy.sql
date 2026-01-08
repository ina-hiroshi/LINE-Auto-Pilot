-- 管理者が全ての店舗情報を閲覧できるポリシーを追加
CREATE POLICY "Admins can view all stores" ON public.stores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- 管理者が全てのプロファイル情報を閲覧できるポリシーを追加（注文一覧で顧客情報を表示するため）
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.is_admin = true
    )
  );
