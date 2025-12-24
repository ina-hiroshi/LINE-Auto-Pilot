
-- Add missing columns to reservations table
alter table public.reservations 
add column if not exists store_id uuid references public.stores(id) on delete cascade,
add column if not exists start_time timestamptz,
add column if not exists end_time timestamptz,
add column if not exists line_user_id text,
add column if not exists status text default 'pending',
add column if not exists memo text,
add column if not exists google_event_id text,
add column if not exists source text default 'line';

-- Enable RLS
alter table public.reservations enable row level security;

-- RLS Policies (Retry)
do $$ begin
    create policy "Users can view their own store's reservations"
        on public.reservations for select
        using (
            store_id in (
                select id from public.stores
                where owner_id = auth.uid()
            )
        );
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create policy "Users can insert their own store's reservations"
        on public.reservations for insert
        with check (
            store_id in (
                select id from public.stores
                where owner_id = auth.uid()
            )
        );
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create policy "Users can update their own store's reservations"
        on public.reservations for update
        using (
            store_id in (
                select id from public.stores
                where owner_id = auth.uid()
            )
        );
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create policy "Users can delete their own store's reservations"
        on public.reservations for delete
        using (
            store_id in (
                select id from public.stores
                where owner_id = auth.uid()
            )
        );
exception
    when duplicate_object then null;
end $$;
