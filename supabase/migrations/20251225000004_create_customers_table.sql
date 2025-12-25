-- Create customers table
create table if not exists public.customers (
    id uuid not null default gen_random_uuid(),
    store_id uuid not null references public.stores(id) on delete cascade,
    line_user_id text not null,
    display_name text,
    profile_picture_url text,
    real_name text,
    furigana text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    primary key (id),
    unique (store_id, line_user_id)
);

-- Enable RLS
alter table public.customers enable row level security;

-- RLS Policies
create policy "Users can view their own store's customers"
    on public.customers for select
    using (
        store_id in (
            select id from public.stores
            where owner_id = auth.uid()
        )
    );

create policy "Users can insert their own store's customers"
    on public.customers for insert
    with check (
        store_id in (
            select id from public.stores
            where owner_id = auth.uid()
        )
    );

create policy "Users can update their own store's customers"
    on public.customers for update
    using (
        store_id in (
            select id from public.stores
            where owner_id = auth.uid()
        )
    );

-- Add trigger to update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger on_customers_updated
    before update on public.customers
    for each row
    execute procedure public.handle_updated_at();
