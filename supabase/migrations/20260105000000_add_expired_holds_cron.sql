-- Enable pg_cron extension for scheduled tasks
create extension if not exists pg_cron with schema extensions;

-- Grant usage to postgres (service role)
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Enable pg_net extension for HTTP requests
create extension if not exists pg_net with schema extensions;

-- Create or replace the function to call the cleanup Edge Function
create or replace function public.cleanup_expired_holds()
returns void
language plpgsql
security definer
as $$
declare
  supabase_url text;
  service_role_key text;
  request_id bigint;
begin
  -- Get environment variables
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If not set, use default (needs to be configured)
  if supabase_url is null then
    supabase_url := 'https://puzmemsawziykgzmbvyh.supabase.co';
  end if;
  
  -- Log start
  raise notice 'Calling cleanup Edge Function at %', now();

  -- Call the Edge Function using pg_net
  select net.http_post(
    url := supabase_url || '/functions/v1/cleanup-expired-holds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(),
    timeout_milliseconds := 30000
  ) into request_id;
  
  -- Log completion
  raise notice 'Cleanup Edge Function called with request_id: %', request_id;
end;
$$;

-- Schedule the cleanup job to run every minute
-- Note: pg_cron uses UTC time
select cron.schedule(
  'cleanup-expired-holds', -- unique job name
  '* * * * *', -- every minute (cron expression)
  'select public.cleanup_expired_holds()'
);

-- Comment
comment on function public.cleanup_expired_holds() is '期限切れの仮押さえとGoogleカレンダーイベントを定期的に削除（毎分実行）';
