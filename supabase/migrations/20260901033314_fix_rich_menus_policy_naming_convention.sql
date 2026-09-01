-- rich_menus バケットは他の store-assets / knowledge_docs とは異なり
-- `${storeId}/ファイル名` というフォルダ形式ではなく、
-- `rich-menu-{storeId}-{timestamp}.png` というフラットな命名規則で
-- 保存されている（frontend/src/pages/RichMenu.tsx の実装、および
-- supabase/functions/delete-account/index.ts のコメントで明記されている
-- 実際の運用）。
--
-- 20260901031658_scope_storage_policies_to_own_store.sql で追加した
-- rich_menus の INSERT/UPDATE ポリシーは、誤って他バケットと同じ
-- フォルダ形式（storage.foldername(name)）でパスを検証していたため、
-- フォルダを持たない実際のファイルは一件も条件を満たせず、本番で
-- リッチメニュー画像の保存機能そのものが失敗する状態になっていた。
-- 本番適用後の回帰確認で発覚し、即座に修正。
--
-- 実際の命名規則 `rich-menu-{storeId}-` の前方一致で所有店舗を
-- 検証するよう修正する。

drop policy if exists "Store owners can upload their own rich menu images" on storage.objects;
create policy "Store owners can upload their own rich menu images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'rich_menus'
    and exists (
      select 1 from public.stores s
      where s.owner_id = auth.uid()
        and storage.objects.name like ('rich-menu-' || s.id::text || '-%')
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
        and storage.objects.name like ('rich-menu-' || s.id::text || '-%')
    )
  );
