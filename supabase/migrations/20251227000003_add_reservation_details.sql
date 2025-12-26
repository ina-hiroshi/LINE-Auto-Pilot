-- Add staff_id and menu_id to reservations table
alter table public.reservations
add column if not exists staff_id uuid references public.staff_members(id) on delete set null,
add column if not exists menu_id uuid references public.booking_menus(id) on delete set null;
