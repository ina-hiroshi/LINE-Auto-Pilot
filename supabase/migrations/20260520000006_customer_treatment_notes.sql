create table if not exists public.customer_treatment_notes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  visited_at timestamptz,
  content text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (store_id, reservation_id)
);

create index if not exists customer_treatment_notes_customer_idx
  on public.customer_treatment_notes (store_id, customer_id);

alter table public.customer_treatment_notes enable row level security;

create policy "Users can view their store treatment notes"
  on public.customer_treatment_notes for select
  using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

create policy "Users can insert their store treatment notes"
  on public.customer_treatment_notes for insert
  with check (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

create policy "Users can update their store treatment notes"
  on public.customer_treatment_notes for update
  using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

create policy "Users can delete their store treatment notes"
  on public.customer_treatment_notes for delete
  using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

insert into public.customer_treatment_notes (store_id, customer_id, reservation_id, content, visited_at)
select
  r.store_id,
  c.id,
  r.id,
  r.memo,
  r.start_time
from public.reservations r
inner join public.customers c
  on c.store_id = r.store_id and c.line_user_id = r.line_user_id
where r.memo is not null
  and trim(r.memo) <> ''
  and r.memo not in ('LINE予約', 'LINE予約(変更)')
on conflict (store_id, reservation_id) do nothing;
