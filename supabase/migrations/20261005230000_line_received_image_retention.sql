-- お客様が送った画像（line-received-images）は 90 日で削除する。
--
-- Supabase の無料プランはストレージが 1GB で、受信画像は放っておくと増え続ける。
-- 画像の用途は「来店前の相談」「商品の確認」などで、数か月残れば足りる。
--
-- ファイルの削除は Storage API を通す必要がある（storage.objects の行を SQL で消しても
-- 実体は残る）ため、Edge Function cleanup-line-images を毎日呼ぶ。
-- 削除した記録は message_image_deleted_at に残し、履歴には
-- 「保存期間を過ぎたため削除しました」と表示する。

alter table public.customer_logs
  add column if not exists message_image_deleted_at timestamptz;

comment on column public.customer_logs.message_image_deleted_at is
  '保存期間（90日）を過ぎて受信画像を削除した日時';

-- 削除対象を引くための索引（画像が残っている行だけ）
create index if not exists customer_logs_image_retention_idx
  on public.customer_logs (created_at)
  where message_image_path is not null and message_image_deleted_at is null;

-- 毎日 04:00 JST (19:00 UTC) に起動する。x-cron-secret は sync-line-friend-count と同じものを使う。
select cron.schedule(
  'cleanup-line-images-daily',
  '0 19 * * *',
  $$
  select net.http_post(
    url := 'https://puzmemsawziykgzmbvyh.supabase.co/functions/v1/cleanup-line-images',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
