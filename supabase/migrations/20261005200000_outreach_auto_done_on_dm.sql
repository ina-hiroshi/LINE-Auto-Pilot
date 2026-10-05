-- Instagram の攻めDMを送ったら、手動施策の台帳に自動で「送信済み」を付ける。
--
-- 送ったDMは social-dm-poll が毎分取り込み、social_messages に outbound で入る。
-- 相手のユーザー名（social_identities.display_name に Instagram の username が入る）が
-- 台帳の target_handle と一致する未実施の行に、送信時刻を done_at として付ける。
-- 画面で手動のチェックを外した行も、その相手へ次に送ったときにまた付く。
create or replace function public.mark_outreach_done_on_outbound_dm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handle text;
begin
  if new.direction <> 'outbound' then
    return new;
  end if;

  select lower(i.display_name) into v_handle
  from public.social_conversations c
  join public.social_identities i on i.id = c.identity_id
  where c.id = new.conversation_id and c.platform = 'instagram';

  if v_handle is null or v_handle = '' then
    return new;
  end if;

  update public.marketing_outreach_items
  set done_at = coalesce(new.occurred_at, now()), updated_at = now()
  where channel = 'instagram'
    and kind = 'action'
    and done_at is null
    and lower(target_handle) = v_handle;

  return new;
end;
$$;

revoke all on function public.mark_outreach_done_on_outbound_dm() from public, anon, authenticated;

create trigger social_messages_mark_outreach_done
  after insert on public.social_messages
  for each row
  execute function public.mark_outreach_done_on_outbound_dm();
