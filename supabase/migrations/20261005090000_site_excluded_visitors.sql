-- サイト閲覧の集計から外すブラウザ（運営者本人の開発・確認用の閲覧と、bot と判明したもの）。
-- 管理画面に管理者としてログインしたブラウザは、フロントが register_own_site_visitor でここに登録する。
-- 登録前の閲覧もさかのぼって集計から外れる。行そのものは消さない。
create table public.site_excluded_visitors (
  visitor_id uuid primary key,
  reason text not null check (reason in ('owner', 'bot')),
  created_at timestamptz not null default now()
);

-- 読み書きとも RPC 経由に限る。ポリシーは置かない。
alter table public.site_excluded_visitors enable row level security;

create or replace function public.register_own_site_visitor(p_visitor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_visitor_id is null then
    return;
  end if;
  insert into public.site_excluded_visitors (visitor_id, reason)
  values (p_visitor_id, 'owner')
  on conflict (visitor_id) do nothing;
end;
$$;

revoke all on function public.register_own_site_visitor(uuid) from public, anon;
grant execute on function public.register_own_site_visitor(uuid) to authenticated;

-- site_page_view_stats を、除外ブラウザの閲覧を除いた集計に差し替える。
-- 除外した閲覧数は excluded として返し、画面の注記に出す。
create or replace function public.site_page_view_stats(p_days integer default 30)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_from timestamptz := ((v_today - (v_days - 1))::timestamp) at time zone 'Asia/Tokyo';
  v_prev_from timestamptz := ((v_today - (2 * v_days - 1))::timestamp) at time zone 'Asia/Tokyo';
  v_result jsonb;
begin
  if not public.current_user_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with counted as (
    select v.* from public.site_page_views v
    where not exists (select 1 from public.site_excluded_visitors e where e.visitor_id = v.visitor_id)
  ),
  cur as (
    select * from counted where viewed_at >= v_from
  ),
  prev as (
    select * from counted where viewed_at >= v_prev_from and viewed_at < v_from
  ),
  excluded as (
    select v.visitor_id, e.reason from public.site_page_views v
    join public.site_excluded_visitors e on e.visitor_id = v.visitor_id
    where v.viewed_at >= v_from
  ),
  -- 訪問（セッション）ごとの最初のページ = 入口ページ
  landings as (
    select distinct on (session_id) session_id, path, source, utm_source, utm_medium, utm_campaign
    from cur
    order by session_id, viewed_at
  )
  select jsonb_build_object(
    'days', v_days,
    'from', (v_today - (v_days - 1)),
    'to', v_today,
    'totals', jsonb_build_object(
      'views', (select count(*) from cur),
      'visitors', (select count(distinct visitor_id) from cur),
      'sessions', (select count(distinct session_id) from cur)
    ),
    'previous', jsonb_build_object(
      'views', (select count(*) from prev),
      'visitors', (select count(distinct visitor_id) from prev),
      'sessions', (select count(distinct session_id) from prev)
    ),
    'excluded', jsonb_build_object(
      'owner_views', (select count(*) from excluded where reason = 'owner'),
      'bot_views', (select count(*) from excluded where reason = 'bot')
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d.day::date, 'views', coalesce(c.views, 0), 'visitors', coalesce(c.visitors, 0)) order by d.day), '[]'::jsonb)
      from generate_series(v_today - (v_days - 1), v_today, interval '1 day') as d(day)
      left join (
        select (viewed_at at time zone 'Asia/Tokyo')::date as day,
               count(*) as views, count(distinct visitor_id) as visitors
        from cur group by 1
      ) c on c.day = d.day::date
    ),
    'pages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', views, 'visitors', visitors) order by views desc, path), '[]'::jsonb)
      from (select path, count(*) as views, count(distinct visitor_id) as visitors from cur group by path) t
    ),
    'landings', (
      select coalesce(jsonb_agg(jsonb_build_object('path', path, 'sessions', sessions) order by sessions desc, path), '[]'::jsonb)
      from (select path, count(*) as sessions from landings group by path) t
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', source, 'sessions', sessions) order by sessions desc, source), '[]'::jsonb)
      from (select source, count(*) as sessions from landings group by source) t
    ),
    'campaigns', (
      select coalesce(jsonb_agg(jsonb_build_object('campaign', utm_campaign, 'source', utm_source, 'medium', utm_medium, 'sessions', sessions) order by sessions desc), '[]'::jsonb)
      from (
        select utm_campaign, utm_source, utm_medium, count(*) as sessions
        from landings where utm_campaign is not null
        group by 1, 2, 3
        order by sessions desc
        limit 20
      ) t
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('device', device, 'views', views) order by views desc), '[]'::jsonb)
      from (select device, count(*) as views from cur group by device) t
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.site_page_view_stats(integer) from public, anon;
grant execute on function public.site_page_view_stats(integer) to authenticated;
