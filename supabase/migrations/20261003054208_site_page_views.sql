-- 製品紹介ページ（トップ・機能紹介・モニター・規約類）の閲覧記録。
-- GA4 やピクセルの管理画面を開かずに、広報画面の「サイト閲覧」タブで閲覧数と流入元を見るために使う。
--
-- 個人を特定する情報は持たない。IP や UA 文字列は保存せず、端末は mobile/desktop の区分だけ。
-- visitor_id はブラウザの localStorage に置いた乱数で、同じ人の再訪をまとめて数えるためだけに使う。
create table public.site_page_views (
  id bigint generated always as identity primary key,
  viewed_at timestamptz not null default now(),
  path text not null,
  visitor_id uuid not null,
  session_id uuid not null,
  -- 流入元。utm_source があればそれ、なければ referrer と fbclid から判定する（record_site_page_view 参照）
  source text not null,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device text not null check (device in ('mobile', 'desktop'))
);

create index site_page_views_viewed_at_idx on public.site_page_views (viewed_at);
create index site_page_views_visitor_idx on public.site_page_views (visitor_id, viewed_at);

-- 読み書きとも RPC 経由に限る。ポリシーは置かない。
alter table public.site_page_views enable row level security;

-- 公開ページから未ログインで呼ばれる記録用 RPC。誰でも叩けるので入力を絞る。
create or replace function public.record_site_page_view(
  p_path text,
  p_visitor_id uuid,
  p_session_id uuid,
  p_referrer_host text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_has_fbclid boolean default false,
  p_device text default 'desktop'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text := nullif(lower(left(trim(coalesce(p_referrer_host, '')), 100)), '');
  v_utm_source text := nullif(lower(left(trim(coalesce(p_utm_source, '')), 60)), '');
  v_source text;
begin
  -- 記録対象は製品紹介ページだけ。予約ページや会員証（店舗のお客さん向け）は含めない。
  if p_path is null
     or length(p_path) > 64
     or p_path !~ '^/(feature/[a-z-]+|monitor|privacy|terms|specified-commercial-transactions|security|security-guide)?$' then
    return;
  end if;
  if p_visitor_id is null or p_session_id is null or p_device not in ('mobile', 'desktop') then
    return;
  end if;

  -- 同じブラウザから1分に30件を超える記録は捨てる（連打・スクリプトによる水増し対策）
  if (
    select count(*) from public.site_page_views
    where visitor_id = p_visitor_id and viewed_at > now() - interval '1 minute'
  ) >= 30 then
    return;
  end if;

  -- 自サイト内の移動は referrer として扱わない
  if v_ref in ('itoguchi-app.jp', 'www.itoguchi-app.jp') then
    v_ref := null;
  end if;

  v_source := case
    when v_utm_source is not null then v_utm_source
    -- Meta のアプリ内ブラウザは referrer を送らないことが多いので fbclid で見分ける
    when p_has_fbclid then 'meta'
    when v_ref is null then 'direct'
    when v_ref ~ '(^|\.)(facebook\.com|instagram\.com|fb\.me)$' then 'meta'
    when v_ref ~ '(^|\.)google\.[a-z.]+$' then 'google'
    when v_ref ~ '(^|\.)yahoo\.(co\.jp|com)$' then 'yahoo'
    when v_ref ~ '(^|\.)bing\.com$' then 'bing'
    when v_ref ~ '(^|\.)(x\.com|twitter\.com|t\.co)$' then 'x'
    when v_ref ~ '(^|\.)(line\.me|line-apps\.com)$' then 'line'
    else v_ref
  end;

  insert into public.site_page_views (
    path, visitor_id, session_id, source, referrer_host,
    utm_source, utm_medium, utm_campaign, device
  ) values (
    p_path, p_visitor_id, p_session_id, v_source, v_ref,
    v_utm_source,
    nullif(lower(left(trim(coalesce(p_utm_medium, '')), 60)), ''),
    nullif(left(trim(coalesce(p_utm_campaign, '')), 100), ''),
    p_device
  );
end;
$$;

revoke all on function public.record_site_page_view(text, uuid, uuid, text, text, text, text, boolean, text) from public;
grant execute on function public.record_site_page_view(text, uuid, uuid, text, text, text, text, boolean, text) to anon, authenticated;

-- 広報画面用の集計。管理者のみ。日の区切りは日本時間。
-- 生の行をフロントに渡すと PostgREST の上限（既定1000行）で黙って欠けるため、ここで集計して返す。
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

  with cur as (
    select * from public.site_page_views where viewed_at >= v_from
  ),
  prev as (
    select * from public.site_page_views where viewed_at >= v_prev_from and viewed_at < v_from
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
