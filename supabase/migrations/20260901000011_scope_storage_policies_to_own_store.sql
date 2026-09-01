-- store-assets / knowledge_docs / rich_menus の storage.objects ポリシーが
-- 「bucket_id が一致する」ことしか確認しておらず、パス（先頭フォルダ = store_id）が
-- 呼び出し元の所有店舗と一致するかを一切見ていなかった。
--
-- 実害:
--   - store-assets: 認証済みなら誰でも、他店舗の会員証ロゴ・ブッキングページ画像・
--     スタッフ写真を上書き/削除できた（INSERT/UPDATE/DELETEにパス制限なし）。
--   - knowledge_docs: 認証済みなら誰でも、他店舗がAI自動応答用にアップロードした
--     PDF/Wordファイル（料金表・業務マニュアル等、機密性の高い内容を含みうる）を
--     閲覧・上書き・削除できた（SELECTすら認可チェックがなかった）。
--   - rich_menus: 認証済みなら誰でも、他店舗のリッチメニュー画像を上書きできた。
--
-- いずれもフロントエンドは常に `${storeId}/...` というパス規約でアップロードしており
-- （storeId は呼び出し元が自分の所有店舗から取得したもの）、実データも全件この規約に
-- 一致していることを事前に確認済み。ポリシー側でこのパスの先頭セグメントが
-- 呼び出し元の所有する stores.id と一致することを要求するよう修正する。

-- store-assets
drop policy if exists "Allow authenticated uploads to store-assets" on storage.objects;
create policy "Store owners can upload to their own store-assets folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'store-assets'
    and exists (
      select 1 from public.stores s
      where s.owner_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

drop policy if exists "Allow authenticated update store-assets" on storage.objects;
create policy "Store owners can update their own store-assets folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'store-assets'
    and exists (
      select 1 from public.stores s
      where s.owner_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

drop policy if exists "Allow authenticated delete store-assets" on storage.objects;
create policy "Store owners can delete their own store-assets folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'store-assets'
    and exists (
      select 1 from public.stores s
      where s.owner_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

-- knowledge_docs（SELECTも含めて全面的にスコープする。業務資料のため公開読み取り不可）
drop policy if exists "Users can view their own knowledge docs" on storage.objects;
create policy "Store owners can view their own knowledge docs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'knowledge_docs'
    and exists (
      select 1 from public.stores s
      where s.owner_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

drop policy if exists "Users can upload knowledge docs" on storage.objects;
create policy "Store owners can upload their own knowledge docs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'knowledge_docs'
    and exists (
      select 1 from public.stores s
      where s.owner_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

drop policy if exists "Users can update their own knowledge docs" on storage.objects;
create policy "Store owners can update their own knowledge docs"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'knowledge_docs'
    and exists (
      select 1 from public.stores s
      where s.owner_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

drop policy if exists "Users can delete their own knowledge docs" on storage.objects;
create policy "Store owners can delete their own knowledge docs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'knowledge_docs'
    and exists (
      select 1 from public.stores s
      where s.owner_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

-- rich_menus
drop policy if exists "Allow authenticated uploads" on storage.objects;
create policy "Store owners can upload their own rich menu images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'rich_menus'
    and exists (
      select 1 from public.stores s
      where s.owner_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

drop policy if exists "Allow individual update" on storage.objects;
create policy "Store owners can update their own rich menu images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'rich_menus'
    and exists (
      select 1 from public.stores s
      where s.owner_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );
