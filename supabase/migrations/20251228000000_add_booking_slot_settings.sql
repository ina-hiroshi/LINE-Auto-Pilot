-- Add slot interval, business hours, and capacity to stores
alter table public.stores
  add column if not exists slot_interval_minutes integer default 60,
  add column if not exists capacity_per_slot integer default 1,
  add column if not exists business_hours jsonb;

-- Add capacity per slot to booking menus (override per menu)
alter table public.booking_menus
  add column if not exists capacity_per_slot integer;
