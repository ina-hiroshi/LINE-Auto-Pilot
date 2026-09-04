-- 配信の進捗（sending → completed/partial/failed）を配信結果画面へ即時反映するため。
--
-- message_campaign_recipients は 1 配信で数百〜数千行動くので Realtime には載せない。
-- 進捗は message_campaigns 側の sent_count / failed_count の更新で表現する。
alter publication supabase_realtime add table public.message_campaigns;
