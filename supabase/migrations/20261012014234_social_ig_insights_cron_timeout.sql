-- social-ig-insights は投稿ごとに insights を呼ぶため、pg_net の既定の待ち時間（5秒）では
-- 応答を待ちきれない。待ち時間を 60 秒にする（呼び出し自体は先に始まっている）。
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'social-ig-insights-daily'),
  command := $$
  select net.http_post(
    url := 'https://puzmemsawziykgzmbvyh.supabase.co/functions/v1/social-ig-insights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
