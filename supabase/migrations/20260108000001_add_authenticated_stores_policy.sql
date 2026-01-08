-- 認証済みユーザーが自分の店舗情報を取得できるポリシーを追加
CREATE POLICY "Authenticated users can view their own stores" ON public.stores
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- 認証済みユーザーが自分の店舗情報を更新できるポリシーを追加
CREATE POLICY "Authenticated users can update their own stores" ON public.stores
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 認証済みユーザーが自分の店舗情報を挿入できるポリシーを追加
CREATE POLICY "Authenticated users can insert their own stores" ON public.stores
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());
