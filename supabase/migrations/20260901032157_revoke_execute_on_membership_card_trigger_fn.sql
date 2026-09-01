-- enforce_membership_card_plan_limits() はトリガー専用関数であり、
-- 通常の関数として直接呼び出されることを意図していない。
-- get_advisors のセキュリティチェックで、この関数が anon/authenticated
-- ロールから PostgREST 経由 (/rest/v1/rpc/enforce_membership_card_plan_limits)
-- で直接実行可能なSECURITY DEFINER関数として公開されている旨の警告が
-- 出たため、直接実行の権限を剥奪する。
-- (トリガーとしての発火はテーブル所有者権限で行われるため、この
-- REVOKEはトリガー経由の動作には影響しない。)

revoke execute on function public.enforce_membership_card_plan_limits() from public, anon, authenticated;
