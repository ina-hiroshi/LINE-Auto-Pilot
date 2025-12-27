-- Re-create points table to ensure correct schema
drop table if exists public.points;

create table public.points (
    id uuid not null default gen_random_uuid(),
    store_id uuid not null references public.stores(id) on delete cascade,
    line_user_id text not null,
    balance integer not null default 0,
    updated_at timestamptz default now(),
    primary key (id),
    unique (store_id, line_user_id)
);

-- Enable RLS
alter table public.points enable row level security;

-- RLS Policies
create policy "Users can view their own store's points"
    on public.points for select
    using (
        store_id in (
            select id from public.stores
            where owner_id = auth.uid()
        )
    );

create policy "Users can insert their own store's points"
    on public.points for insert
    with check (
        store_id in (
            select id from public.stores
            where owner_id = auth.uid()
        )
    );

create policy "Users can update their own store's points"
    on public.points for update
    using (
        store_id in (
            select id from public.stores
            where owner_id = auth.uid()
        )
    );

-- Add trigger to update updated_at
create trigger handle_updated_at before update on public.points
    for each row execute procedure public.handle_updated_at();
