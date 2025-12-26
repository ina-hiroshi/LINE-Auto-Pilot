-- Create staff_members table
create table if not exists public.staff_members (
  id uuid not null default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  role text,
  image_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  primary key (id)
);

-- Create booking_menus table
create table if not exists public.booking_menus (
  id uuid not null default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  price integer,
  duration_minutes integer,
  is_active boolean default true,
  created_at timestamptz default now(),
  primary key (id)
);

-- Enable RLS
alter table public.staff_members enable row level security;
alter table public.booking_menus enable row level security;

-- RLS Policies for Staff
create policy "Users can manage their own store staff" on public.staff_members
  using (store_id in (select id from public.stores where owner_id = auth.uid()))
  with check (store_id in (select id from public.stores where owner_id = auth.uid()));

create policy "Public read access to active staff" on public.staff_members
  for select
  to anon
  using (is_active = true);

-- RLS Policies for Menus
create policy "Users can manage their own store menus" on public.booking_menus
  using (store_id in (select id from public.stores where owner_id = auth.uid()))
  with check (store_id in (select id from public.stores where owner_id = auth.uid()));

create policy "Public read access to active menus" on public.booking_menus
  for select
  to anon
  using (is_active = true);
