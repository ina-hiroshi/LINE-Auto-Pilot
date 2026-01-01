-- 店舗の特別営業日・定休日設定
create table if not exists public.booking_special_dates (
  id uuid not null default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  is_closed boolean default false, -- 臨時定休日
  override_hours jsonb, -- [{"start": "10:00", "end": "18:00"}] 営業時間の上書き
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id),
  unique(store_id, date)
);

-- スタッフの基本勤務パターン（曜日別）
create table if not exists public.staff_work_patterns (
  id uuid not null default gen_random_uuid(),
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=日, 1=月, ..., 6=土
  start_time time not null,
  end_time time not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id),
  unique(staff_id, day_of_week)
);

-- スタッフの特別スケジュール（個別日）
create table if not exists public.staff_special_schedules (
  id uuid not null default gen_random_uuid(),
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  date date not null,
  is_absent boolean default false, -- 休暇・不在
  override_start time, -- 勤務時間の上書き（出勤の場合）
  override_end time,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id),
  unique(staff_id, date)
);

-- インデックスの作成
create index if not exists idx_special_dates_store_date on public.booking_special_dates(store_id, date);
create index if not exists idx_work_patterns_staff on public.staff_work_patterns(staff_id);
create index if not exists idx_special_schedules_staff_date on public.staff_special_schedules(staff_id, date);

-- RLS有効化
alter table public.booking_special_dates enable row level security;
alter table public.staff_work_patterns enable row level security;
alter table public.staff_special_schedules enable row level security;

-- RLSポリシー: 店舗オーナーのみ管理可能
create policy "Store owners can manage special dates" on public.booking_special_dates
  for all
  using (store_id in (select id from public.stores where owner_id = auth.uid()))
  with check (store_id in (select id from public.stores where owner_id = auth.uid()));

create policy "Public read special dates" on public.booking_special_dates
  for select
  to anon
  using (true);

create policy "Store owners can manage staff work patterns" on public.staff_work_patterns
  for all
  using (staff_id in (select sm.id from public.staff_members sm join public.stores s on sm.store_id = s.id where s.owner_id = auth.uid()))
  with check (staff_id in (select sm.id from public.staff_members sm join public.stores s on sm.store_id = s.id where s.owner_id = auth.uid()));

create policy "Public read staff work patterns" on public.staff_work_patterns
  for select
  to anon
  using (true);

create policy "Store owners can manage staff special schedules" on public.staff_special_schedules
  for all
  using (staff_id in (select sm.id from public.staff_members sm join public.stores s on sm.store_id = s.id where s.owner_id = auth.uid()))
  with check (staff_id in (select sm.id from public.staff_members sm join public.stores s on sm.store_id = s.id where s.owner_id = auth.uid()));

create policy "Public read staff special schedules" on public.staff_special_schedules
  for select
  to anon
  using (true);

-- コメント
comment on table public.booking_special_dates is '店舗の特別営業日・臨時定休日設定';
comment on table public.staff_work_patterns is 'スタッフの基本勤務パターン（曜日別）';
comment on table public.staff_special_schedules is 'スタッフの特別スケジュール（個別日の休暇・特別出勤）';
