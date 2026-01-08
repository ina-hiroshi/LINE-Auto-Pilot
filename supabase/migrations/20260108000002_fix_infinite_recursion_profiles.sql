-- 無限再帰を引き起こすprofilesテーブルの管理者ポリシーを削除
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- storesテーブルの管理者ポリシーもprofilesテーブルを参照しているため、
-- これも削除して、別の方法で実装する必要があります
DROP POLICY IF EXISTS "Admins can view all stores" ON public.stores;

-- 認証済みユーザーが自分の店舗情報を取得できるポリシー（既存のポリシーがある場合はスキップ）
-- このポリシーは既に存在する可能性があるため、IF NOT EXISTSは使用できない
-- 代わりに、ポリシーが存在しない場合のみ作成する
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'stores' 
    AND policyname = 'Users can view their own stores'
  ) THEN
    CREATE POLICY "Users can view their own stores" ON public.stores
      FOR SELECT
      USING (owner_id = auth.uid());
  END IF;
END $$;
