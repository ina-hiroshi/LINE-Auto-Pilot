-- 製品紹介ページで押されたボタンの記録。
-- 閲覧のあと「LINEで試す」「無料で始める」「モニター特典」のどれに進んだかを、広報画面の「サイト閲覧」タブで見るために使う。
--
-- site_page_views と同じく、個人を特定する情報は持たない。visitor_id・session_id は同じ乱数を使い、閲覧と突き合わせられる。
create table public.site_clicks (
  id bigint generated always as identity primary key,
  clicked_at timestamptz not null default now(),
  -- line_demo：デモ用LINE公式アカウントの友だち追加 / signup：無料で始める / monitor：モニター特典
  target text not null check (target in ('line_demo', 'signup', 'monitor')),
  -- 押したページ
  path text not null,
  visitor_id uuid not null,
  session_id uuid not null,
  device text not null check (device in ('mobile', 'desktop'))
);

create index site_clicks_clicked_at_idx on public.site_clicks (clicked_at);
create index site_clicks_visitor_idx on public.site_clicks (visitor_id, clicked_at);

-- 読み書きとも RPC 経由に限る。ポリシーは置かない。
alter table public.site_clicks enable row level security;

-- 公開ページから未ログインで呼ばれる記録用 RPC。誰でも叩けるので入力を絞る。
create or replace function public.record_site_click(
  p_target text,
  p_path text,
  p_visitor_id uuid,
  p_session_id uuid,
  p_device text default 'desktop'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_target is null or p_target not in ('line_demo', 'signup', 'monitor') then
    return;
  end if;
  -- 記録するのは record_site_page_view と同じ製品紹介ページだけ
  if p_path is null
     or length(p_path) > 64
     or p_path !~ '^/(feature/[a-z-]+|monitor|privacy|terms|specified-commercial-transactions|security|security-guide)?$' then
    return;
  end if;
  if p_visitor_id is null or p_session_id is null or p_device not in ('mobile', 'desktop') then
    return;
  end if;

  -- 同じブラウザから1分に10件を超える記録は捨てる（連打・スクリプトによる水増し対策）
  if (
    select count(*) from public.site_clicks
    where visitor_id = p_visitor_id and clicked_at > now() - interval '1 minute'
  ) >= 10 then
    return;
  end if;

  insert into public.site_clicks (target, path, visitor_id, session_id, device)
  values (p_target, p_path, p_visitor_id, p_session_id, p_device);
end;
$$;

revoke all on function public.record_site_click(text, text, uuid, uuid, text) from public;
grant execute on function public.record_site_click(text, text, uuid, uuid, text) to anon, authenticated;

-- 管理者専用の集計。期間の決め方は site_page_view_stats と同じ（日本時間で今日を含む p_days 日）。
create or replace function public.site_click_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_from timestamptz := ((v_today - (v_days - 1))::timestamp) at time zone 'Asia/Tokyo';
  v_result jsonb;
begin
  if not public.current_user_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with cur as (
    select c.* from public.site_clicks c
    where c.clicked_at >= v_from
      and not exists (select 1 from public.site_excluded_visitors e where e.visitor_id = c.visitor_id)
  )
  select jsonb_build_object(
    'targets', (
      select coalesce(jsonb_agg(jsonb_build_object('target', target, 'clicks', clicks, 'visitors', visitors) order by clicks desc, target), '[]'::jsonb)
      from (select target, count(*) as clicks, count(distinct visitor_id) as visitors from cur group by target) t
    ),
    'by_page', (
      select coalesce(jsonb_agg(jsonb_build_object('target', target, 'path', path, 'clicks', clicks) order by clicks desc, path), '[]'::jsonb)
      from (select target, path, count(*) as clicks from cur group by target, path) t
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.site_click_stats(integer) from public, anon;
grant execute on function public.site_click_stats(integer) to authenticated;
