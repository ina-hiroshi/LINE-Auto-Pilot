-- ai_rate_limits は line-webhook がサービスロールで読み書きする内部テーブルで、
-- ブラウザからは一切触らない。
--
-- ところが "Service role full access on ai_rate_limits" ポリシーが
-- 名前に反して public ロール（anon / authenticated を含む）に付いており、
-- USING / WITH CHECK も true だった。テーブルの GRANT も anon に
-- SELECT/INSERT/UPDATE/DELETE が付いたままだったため、公開されている
-- anon キーだけで
--   - どの店舗の誰がいつ AI を使ったか（line_user_id を含む）を読み出せる
--   - 行を削除して AI 利用回数の上限をリセットできる（AI 利用料の抑制が無効化される）
-- 状態になっていた。
--
-- サービスロールは RLS を迂回するため、ポリシーは不要。
-- ポリシーを落とし、anon / authenticated の権限も剥がす。

drop policy if exists "Service role full access on ai_rate_limits" on public.ai_rate_limits;

revoke all on public.ai_rate_limits from anon;
revoke all on public.ai_rate_limits from authenticated;
