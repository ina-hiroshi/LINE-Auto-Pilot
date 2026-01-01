-- Create temporary_holds table for slot reservation during booking process
create table if not exists public.temporary_holds (
  id uuid not null default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  line_user_id text not null,
  staff_id uuid references public.staff_members(id) on delete cascade,
  menu_id uuid references public.booking_menus(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  google_event_id text, -- Google Calendar仮予約のイベントID
  created_at timestamptz default now(),
  primary key (id)
);

-- Index for efficient queries
create index if not exists idx_temporary_holds_store_time on public.temporary_holds(store_id, start_time, end_time);
create index if not exists idx_temporary_holds_expires on public.temporary_holds(expires_at);
create index if not exists idx_temporary_holds_user on public.temporary_holds(line_user_id);

-- Enable RLS
alter table public.temporary_holds enable row level security;

-- RLS Policies
create policy "Users can manage their own holds" on public.temporary_holds
  for all
  using (line_user_id = auth.jwt() ->> 'sub' or store_id in (select id from public.stores where owner_id = auth.uid()))
  with check (line_user_id = auth.jwt() ->> 'sub' or store_id in (select id from public.stores where owner_id = auth.uid()));

-- Anonymous users can read (for slot availability check)
create policy "Service role can manage all holds" on public.temporary_holds
  for all
  to service_role
  using (true)
  with check (true);

-- Function to auto-delete expired holds (optional, can be called via cron or checked in queries)
create or replace function delete_expired_holds()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.temporary_holds
  where expires_at < now();
end;
$$;

-- Comment
comment on table public.temporary_holds is '予約プロセス中の時間枠仮押さえ（10分間有効）';
