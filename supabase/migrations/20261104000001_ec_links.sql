create table public.ec_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  ec_shop_id uuid not null unique,
  ec_shop_url text not null,
  ec_shop_name text not null default '',
  token_hash text not null unique,
  entitled_until timestamptz,
  linked_at timestamptz not null default now()
);
create table public.ec_link_codes (
  code_hash text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.ec_links enable row level security;
alter table public.ec_link_codes enable row level security;
revoke all on public.ec_links, public.ec_link_codes from public, anon, authenticated;
grant all on public.ec_links, public.ec_link_codes to service_role;

create or replace function public.effective_plan(p_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_plan text;
begin
  select p.plan into v_plan from public.profiles p where p.id = p_user_id;
  if v_plan in ('pro', 'executive') then return v_plan; end if;
  if exists (select 1 from public.stores s join public.ec_links l on l.store_id = s.id
    where s.owner_id = p_user_id and l.entitled_until > now()) then return 'pro'; end if;
  return coalesce(v_plan, 'free');
end;
$$;
revoke all on function public.effective_plan(uuid) from public, anon, authenticated;
grant execute on function public.effective_plan(uuid) to service_role;

create or replace function public.my_effective_plan()
returns text language sql stable security definer set search_path = '' as $$
  select public.effective_plan(auth.uid());
$$;
revoke all on function public.my_effective_plan() from public, anon;
grant execute on function public.my_effective_plan() to authenticated;

create or replace function public.my_ec_link()
returns table(ec_shop_name text, ec_shop_url text, entitled boolean, linked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.ec_shop_name, l.ec_shop_url, coalesce(l.entitled_until > now(), false), l.linked_at
  from public.ec_links l join public.stores s on s.id = l.store_id
  where s.owner_id = auth.uid();
$$;
revoke all on function public.my_ec_link() from public, anon;
grant execute on function public.my_ec_link() to authenticated;

create or replace function public.enforce_membership_card_plan_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_plan text;
begin
  v_plan := public.effective_plan(new.owner_id);
  if v_plan is distinct from 'pro' and v_plan is distinct from 'executive' then
    new.membership_card_template_id := 'simple';
    new.membership_card_color := '#ffffff';
    new.membership_card_logo_url := null;
  end if;
  return new;
end;
$$;

-- The lock and unique constraints serialize code consumption and prevent double linking.
-- Raising an exception also rolls back used_at when linking fails.
create function public.exchange_ec_link(p_code_hash text, p_ec_shop_id uuid,
  p_ec_shop_url text, p_ec_shop_name text, p_token_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code public.ec_link_codes%rowtype; v_store_name text;
begin
  select * into v_code from public.ec_link_codes where code_hash = p_code_hash for update;
  if not found or v_code.used_at is not null or v_code.expires_at <= now() then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.ec_links where store_id = v_code.store_id or ec_shop_id = p_ec_shop_id) then
    raise exception 'already_linked' using errcode = 'P0001';
  end if;
  insert into public.ec_links(store_id, ec_shop_id, ec_shop_url, ec_shop_name, token_hash)
    values(v_code.store_id, p_ec_shop_id, p_ec_shop_url, p_ec_shop_name, p_token_hash);
  update public.ec_link_codes set used_at = now() where code_hash = p_code_hash;
  select s.name into v_store_name from public.stores s where s.id = v_code.store_id;
  return v_store_name;
exception when unique_violation then
  raise exception 'already_linked' using errcode = 'P0001';
end;
$$;
revoke all on function public.exchange_ec_link(text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.exchange_ec_link(text, uuid, text, text, text) to service_role;

-- Serialize issuance for a store, keeping exactly one unused code even when
-- multiple browser requests arrive together. Called only after owner verification.
create function public.issue_ec_link_code(p_store_id uuid, p_code_hash text, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.stores where id = p_store_id for update;
  if not found then raise exception 'store_not_found'; end if;
  delete from public.ec_link_codes where store_id = p_store_id and used_at is null;
  insert into public.ec_link_codes(code_hash, store_id, expires_at)
    values (p_code_hash, p_store_id, p_expires_at);
end;
$$;
revoke all on function public.issue_ec_link_code(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.issue_ec_link_code(uuid, text, timestamptz) to service_role;
