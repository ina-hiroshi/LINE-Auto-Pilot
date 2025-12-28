alter table public.stores
add column if not exists membership_card_title text default 'MEMBER''S CARD',
add column if not exists membership_card_color text default '#000000',
add column if not exists membership_card_logo_url text;
