-- Enable pg_cron extension for scheduled tasks
create extension if not exists pg_cron with schema extensions;

-- Grant usage to postgres (service role)
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Create or replace the function to delete expired holds and their Google Calendar events
create or replace function public.cleanup_expired_holds()
returns void
language plpgsql
security definer
as $$
declare
  hold_record record;
begin
  -- Log start
  raise notice 'Starting cleanup of expired holds at %', now();

  -- Delete expired holds (Google Calendar events are handled separately by the booking function)
  -- Just delete the database records - Google Calendar cleanup can be handled async
  delete from public.temporary_holds
  where expires_at < now();
  
  -- Log completion
  raise notice 'Expired holds cleanup completed at %', now();
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
comment on function public.cleanup_expired_holds() is '期限切れの仮押さえを定期的に削除（毎分実行）';
