-- social-dm-poll を5分ごとに起動する。webhook が無い間の唯一の受信経路なので、
-- DM ウィンドウ（24時間）に対して十分短い間隔にする。IG トークンが未設定・
-- pages_messaging が未取得の間は関数側が {skipped:true} を返すだけで何もしない。
select cron.schedule(
  'social-dm-poll-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://puzmemsawziykgzmbvyh.supabase.co/functions/v1/social-dm-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
