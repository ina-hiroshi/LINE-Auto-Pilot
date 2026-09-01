-- 直前の 20260901031658_scope_storage_policies_to_own_store.sql には、
-- EXISTS句の中で bare な `name` を参照しており、`public.stores` にも
-- `name` 列(店舗名)があるため、Postgresの列解決規則により意図した
-- storage.objects.name ではなく stores.name の方に解決されてしまう
-- バグがあった。
--
-- 結果として全てのポリシーが「stores.id を stores.name からパース
-- した文字列と比較する」という成立し得ない条件になり、Free/Pro・
-- 自店舗/他店舗を問わず全ユーザーの正規の書き込みが失敗する状態に
-- なっていた（fail-closedなので情報漏洩はないが、機能が壊れる）。
-- 本番適用直後の検証で発覚し、即座に修正。
--
-- storage.objects.name を明示的に修飾することで解決する。

drop policy if exists "Store owners can upload to their own store-assets folder" on storage.objects;
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

drop policy if exists "Store owners can update their own store-assets folder" on storage.objects;
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

drop policy if exists "Store owners can delete their own store-assets folder" on storage.objects;
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

drop policy if exists "Store owners can view their own knowledge docs" on storage.objects;
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

drop policy if exists "Store owners can upload their own knowledge docs" on storage.objects;
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

drop policy if exists "Store owners can update their own knowledge docs" on storage.objects;
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

drop policy if exists "Store owners can delete their own knowledge docs" on storage.objects;
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

drop policy if exists "Store owners can upload their own rich menu images" on storage.objects;
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

drop policy if exists "Store owners can update their own rich menu images" on storage.objects;
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
