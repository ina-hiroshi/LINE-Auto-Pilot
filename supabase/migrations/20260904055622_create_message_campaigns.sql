-- 顧客セグメント配信（一斉送信）のキャンペーン管理
--
-- 1対1チャットの customer_logs とは別テーブルにする。customer_logs は
-- 「顧客ごとの会話スレッド」として顧客詳細画面から読まれており、そこへ
-- 一斉配信の記録を混ぜるとチャット履歴が配信ログで埋まる。
--
-- 書き込みは Edge Function（service_role）経由のみとし、オーナーには
-- SELECT だけを許可する。オーナーが status や sent_count を直接書き換え
-- られると、送信済みキャンペーンを未送信状態に戻して同じ相手に二重送信
-- させられる（送信は LINE の月間配信数を消費する）。social_posts と同じ方針。

create table if not exists public.message_campaigns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  segment_type text not null check (segment_type in (
    'all', 'visited', 'prospective', 'dormant', 'recent',
    'repeat', 'menu', 'staff', 'high_spender', 'manual'
  )),
  segment_params jsonb not null default '{}'::jsonb,
  message_text text not null,
  ai_generated boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'sending', 'completed', 'partial', 'failed')),
  total_recipients integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error text
);

comment on column public.message_campaigns.sent_count is
  'LINE multicast API への送信要求が成功した宛先数。LINE は宛先ごとの成否を返さないため、到達数でも既読数でもない。';
comment on column public.message_campaigns.segment_params is
  'セグメントの絞り込み条件。例: {"dormant_days":60} / {"menu_id":"..."} / {"customer_ids":[...]}';
comment on column public.message_campaigns.status is
  'partial: 一部バッチのみ送信失敗。failed: 全バッチ失敗。';

create index if not exists message_campaigns_store_created_idx
  on public.message_campaigns (store_id, created_at desc);

alter table public.message_campaigns enable row level security;

-- 参照のみオーナーに許可する。INSERT/UPDATE は service_role（Edge Function）限定。
-- TO authenticated を必ず付ける。付けないと role = public 扱いになり、anon から
-- 評価されたときに stores の副問い合わせで permission denied を起こす
-- （20260831000003 参照）。
-- テーブル側は if not exists で作り直しに耐えるようにしてあるので、
-- ポリシーだけ「既にある」で落ちないよう先に落とす。
drop policy if exists "Users can view their own store's message campaigns"
  on public.message_campaigns;
create policy "Users can view their own store's message campaigns"
  on public.message_campaigns for select
  to authenticated
  using (
    store_id in (
      select id from public.stores
      where owner_id = auth.uid()
    )
  );


-- 配信先ごとの送信結果。
--
-- LINE の multicast API はリクエスト単位でしか成否を返さない（宛先ごとの
-- 結果は取れない）ため、status は「その宛先が属するバッチの送信結果」を表す。
create table if not exists public.message_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.message_campaigns(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  line_user_id text not null,
  batch_index integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  claimed_at timestamptz,
  error_message text,
  sent_at timestamptz
);

comment on column public.message_campaign_recipients.status is
  'sending は送信処理中（claim済み）。sent/failed は multicast のバッチ単位の結果で、個々の宛先に届いたかは LINE API では判定できない。';
comment on column public.message_campaign_recipients.claimed_at is
  'claim した時刻。処理が途中で落ちて sending のまま残った行を回収するために使う。';

create index if not exists message_campaign_recipients_campaign_status_idx
  on public.message_campaign_recipients (campaign_id, status);

-- 同じキャンペーンで同じ宛先を二度登録しない（重複送信の防止）
create unique index if not exists message_campaign_recipients_unique_target_idx
  on public.message_campaign_recipients (campaign_id, line_user_id);

alter table public.message_campaign_recipients enable row level security;

drop policy if exists "Users can view their own store's campaign recipients"
  on public.message_campaign_recipients;
create policy "Users can view their own store's campaign recipients"
  on public.message_campaign_recipients for select
  to authenticated
  using (
    campaign_id in (
      select c.id from public.message_campaigns c
      where c.store_id in (
        select id from public.stores
        where owner_id = auth.uid()
      )
    )
  );


-- テーブル権限を暗黙のデフォルトに任せない。
--
-- public スキーマの default privileges は環境によって中身が違う。この
-- プロジェクトの本番は新規テーブルに対し anon/authenticated へ ALL を
-- 与える設定で、その場合 INSERT/UPDATE/DELETE を止めているのは RLS
-- （= 該当ポリシーが無いこと）だけになる。一方、最近の Supabase の
-- 既定は SELECT すら与えないので、そちらでは配信履歴が
-- 「permission denied」で開かなくなる。どちらにも寄せられるよう、
-- 必要な権限をこの migration で明示する。
revoke all on public.message_campaigns from anon, authenticated;
revoke all on public.message_campaign_recipients from anon, authenticated;

grant select on public.message_campaigns to authenticated;
grant select on public.message_campaign_recipients to authenticated;

grant select, insert, update, delete on public.message_campaigns to service_role;
grant select, insert, update, delete on public.message_campaign_recipients to service_role;


-- 未送信バッチを1つ確保する。
--
-- 確保は status を 'sending' に更新して永続化する。行ロックだけでは
-- トランザクション終了と同時にロックが消え、同じバッチを別のワーカーが
-- もう一度送ってしまう（LINE の配信数を二重に消費し、顧客にも二通届く）。
-- claim_next_social_post() が status を 'publishing' に倒すのと同じ理由。
--
-- 同一バッチの行をまとめて 1 文で更新することで、バッチ単位で不可分に確保する。
-- 競合したワーカーは skip locked により 0 行を受け取る。呼び出し側は
-- 「0行 = このキャンペーンは完了」と解釈してはならず、pending/sending の
-- 残数を数えてから完了判定すること。
create or replace function public.claim_next_campaign_batch(p_campaign_id uuid)
returns table (batch_index integer, line_user_id text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    update public.message_campaign_recipients r
    set status = 'sending', claimed_at = now()
    where r.id in (
      select r2.id
      from public.message_campaign_recipients r2
      where r2.campaign_id = p_campaign_id
        and r2.status = 'pending'
        and r2.batch_index = (
          select min(r3.batch_index)
          from public.message_campaign_recipients r3
          where r3.campaign_id = p_campaign_id
            and r3.status = 'pending'
        )
      for update skip locked
    )
    returning r.batch_index, r.line_user_id
  )
  select c.batch_index, c.line_user_id from claimed c;
end;
$$;

revoke all on function public.claim_next_campaign_batch(uuid) from public, anon, authenticated;
grant execute on function public.claim_next_campaign_batch(uuid) to service_role;


-- 送信処理が途中で落ちて 'sending' のまま取り残された行を pending に戻す。
-- 中断された配信を店舗が再開できるようにするための回収口。
--
-- 必ず 1 キャンペーンに限定する。対象を絞らないと、ある店舗の再開操作が
-- 別店舗の送信中バッチまで pending に戻し、そちらで二重送信を起こす。
--
-- p_stale_minutes は「1 バッチの送信にかかる最長時間」より大きく、かつ
-- 小さく取る。長すぎると再開ボタンが押しても何も起きないボタンになり
-- （中断直後の行は claimed_at がまだ新しい）、0 にすると実行中の送信から
-- バッチを奪って二重送信になる。
create or replace function public.reclaim_stale_campaign_batches(
  p_campaign_id uuid,
  p_stale_minutes integer default 2
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reclaimed integer;
begin
  update public.message_campaign_recipients
  set status = 'pending', claimed_at = null
  where campaign_id = p_campaign_id
    and status = 'sending'
    and claimed_at < now() - make_interval(mins => p_stale_minutes);

  get diagnostics reclaimed = row_count;
  return reclaimed;
end;
$$;

revoke all on function public.reclaim_stale_campaign_batches(uuid, integer) from public, anon, authenticated;
grant execute on function public.reclaim_stale_campaign_batches(uuid, integer) to service_role;


-- 送信数・失敗数・ステータスを配信先テーブルから数え直して反映する。
--
-- カウンタを読んで足して書き戻す形にすると、同期送信と cron ドレインが
-- 並行したときに更新が失われる。また「claim が 0 件だった」を完了条件に
-- すると、他のワーカーが処理中のバッチを残したまま completed にしてしまう。
-- 常に配信先テーブルの実際の行を数えることで、どちらの競合も起きない。
create or replace function public.sync_campaign_progress(p_campaign_id uuid)
returns public.message_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent integer;
  v_failed integer;
  v_remaining integer;
  result public.message_campaigns;
begin
  select
    count(*) filter (where r.status = 'sent'),
    count(*) filter (where r.status = 'failed'),
    count(*) filter (where r.status in ('pending', 'sending'))
  into v_sent, v_failed, v_remaining
  from public.message_campaign_recipients r
  where r.campaign_id = p_campaign_id;

  update public.message_campaigns c
  set
    sent_count = v_sent,
    failed_count = v_failed,
    status = case
      when v_remaining > 0 then 'sending'
      when v_failed = 0 then 'completed'
      when v_sent = 0 then 'failed'
      else 'partial'
    end,
    completed_at = case when v_remaining > 0 then null else now() end
  where c.id = p_campaign_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.sync_campaign_progress(uuid) from public, anon, authenticated;
grant execute on function public.sync_campaign_progress(uuid) to service_role;
