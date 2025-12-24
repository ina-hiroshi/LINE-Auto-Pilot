drop table if exists public.auto_responses;

create table public.auto_responses (
    id uuid not null default gen_random_uuid(),
    store_id uuid not null references public.stores(id) on delete cascade,
    keyword text not null,
    sub_keywords text[] default array[]::text[],
    response_text text not null,
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    primary key (id)
);

alter table public.auto_responses enable row level security;

create policy "Users can view their own store's auto responses"
    on public.auto_responses for select
    using (
        store_id in (
            select id from public.stores
            where owner_id = auth.uid()
        )
    );

create policy "Users can insert their own store's auto responses"
    on public.auto_responses for insert
    with check (
        store_id in (
            select id from public.stores
            where owner_id = auth.uid()
        )
    );

create policy "Users can update their own store's auto responses"
    on public.auto_responses for update
    using (
        store_id in (
            select id from public.stores
            where owner_id = auth.uid()
        )
    );

create policy "Users can delete their own store's auto responses"
    on public.auto_responses for delete
    using (
        store_id in (
            select id from public.stores
            where owner_id = auth.uid()
        )
    );
