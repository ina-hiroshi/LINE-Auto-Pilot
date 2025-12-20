-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends auth.users)
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  plan text default 'free',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for profiles
alter table profiles enable row level security;

create policy "Users can view their own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on profiles
  for update using (auth.uid() = id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Line Accounts table
create table line_accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  channel_id text,
  channel_secret text,
  channel_token text,
  bot_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id) -- One LINE account per user for now (based on Free plan limit)
);

alter table line_accounts enable row level security;

create policy "Users can view their own line account" on line_accounts
  for select using (auth.uid() = user_id);

create policy "Users can insert their own line account" on line_accounts
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own line account" on line_accounts
  for update using (auth.uid() = user_id);

create policy "Users can delete their own line account" on line_accounts
  for delete using (auth.uid() = user_id);


-- Auto Responses table
create table auto_responses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  keyword text not null,
  response_text text not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table auto_responses enable row level security;

create policy "Users can CRUD their own auto responses" on auto_responses
  for all using (auth.uid() = user_id);


-- Reservations table
create table reservations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  line_user_id text not null, -- LINE user ID of the customer
  line_display_name text, -- Display name of the customer
  reservation_date timestamp with time zone not null,
  status text default 'pending', -- pending, confirmed, cancelled, completed
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table reservations enable row level security;

create policy "Users can CRUD their own reservations" on reservations
  for all using (auth.uid() = user_id);


-- Points table
create table points (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  line_user_id text not null,
  line_display_name text,
  balance integer default 0,
  last_updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, line_user_id)
);

alter table points enable row level security;

create policy "Users can CRUD their own points" on points
  for all using (auth.uid() = user_id);
