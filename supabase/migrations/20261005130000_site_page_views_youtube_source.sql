-- YouTube（ショートの概要欄・チャンネルのリンク）からの訪問を流入元 youtube として数える。
-- 関数本体は 20261003054208_site_page_views.sql と同じで、判定に1行足しただけ。
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
    when v_ref ~ '(^|\.)(youtube\.com|youtu\.be)$' then 'youtube'
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

-- 既に記録済みの YouTube からの訪問も付け替える
update public.site_page_views
set source = 'youtube'
where utm_source is null
  and referrer_host ~ '(^|\.)(youtube\.com|youtu\.be)$';
