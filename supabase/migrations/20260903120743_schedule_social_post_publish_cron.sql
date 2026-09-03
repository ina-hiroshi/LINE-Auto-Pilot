create extension if not exists pg_net;

select cron.schedule(
  'social-post-daily-publish',
  '0 12 * * *', -- 21:00 JST
  $$
  select net.http_post(
    url := 'https://puzmemsawziykgzmbvyh.supabase.co/functions/v1/social-post-publish',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
