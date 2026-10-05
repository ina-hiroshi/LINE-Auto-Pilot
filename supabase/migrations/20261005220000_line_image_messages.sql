-- LINE のトークで画像をやり取りできるようにする。
--
-- 受信（お客様 → 店舗）:
--   これまでは「[画像が送信されました]」という文言だけを記録し、画像そのものは
--   店舗が見られなかった。LINE 側のコンテンツは保存期間が限られるため、Webhook を
--   受けた時点で取得して line-received-images に保存し、そのパスを記録する。
--   お客様の写真は個人情報なので、バケットは非公開にし、店舗の所有者だけが
--   署名 URL で閲覧できるようにする。
--
-- 送信（店舗 → お客様）:
--   LINE の画像メッセージは「認証なしで取得できる HTTPS の URL」しか受け付けない。
--   そのため送信用の画像は公開バケット line-sent-images に置く。ファイル名は
--   推測できない UUID にし、アップロード・削除は自分の店舗のフォルダに限る。
--
-- message_content は NOT NULL で、ダッシュボードの一覧や AI 分析が読んでいるため
-- 文言は従来どおり残し、画像は別の列で持つ。

alter table public.customer_logs
  add column if not exists message_image_path text,
  add column if not exists reply_image_url text;

comment on column public.customer_logs.message_image_path is
  'お客様が送った画像の line-received-images 内のパス（{store_id}/...）。取得できなかった場合は null';
comment on column public.customer_logs.reply_image_url is
  '店舗が送った画像の公開 URL（line-sent-images）';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('line-received-images', 'line-received-images', false, 10485760,
    array['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('line-sent-images', 'line-sent-images', true, 10485760,
    array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- 受信画像: 書き込みは Webhook（service role）だけ。店舗の所有者は自分の店舗の分だけ閲覧できる。
-- storage.objects.name を修飾しないと stores.name に解決される（20260901031816 参照）。
drop policy if exists "Store owners can view their own received LINE images" on storage.objects;
create policy "Store owners can view their own received LINE images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'line-received-images'
    and exists (
      select 1 from public.stores s
      where s.owner_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

-- 送信画像: 公開バケットなので閲覧は誰でもできる。アップロードと削除は自分の店舗のフォルダだけ。
drop policy if exists "Store owners can upload LINE images to send" on storage.objects;
create policy "Store owners can upload LINE images to send"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'line-sent-images'
    and exists (
      select 1 from public.stores s
      where s.owner_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

drop policy if exists "Store owners can delete their sent LINE images" on storage.objects;
create policy "Store owners can delete their sent LINE images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'line-sent-images'
    and exists (
      select 1 from public.stores s
      where s.owner_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );
