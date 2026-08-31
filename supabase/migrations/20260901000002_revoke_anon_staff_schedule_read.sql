-- スタッフの基本シフト(staff_work_patterns)と特定日の予定(staff_special_schedules)は
-- anon に `USING (true)` の SELECT ポリシーが付いており、公開されている anon キーだけで
-- 全店舗ぶんの出勤時間・休みの日を読み出せる状態だった。
--
-- これらを読むのは
--   - 店舗管理画面（StaffShiftTab / CalendarSettingsTab）… ログイン済みユーザー
--   - booking Edge Function（空き枠計算）… サービスロール（RLS を迂回する）
-- のみで、LIFF の予約画面が直接読むことはない。anon 向けポリシーを落とす。
--
-- staff_members / booking_menus / booking_special_dates は LIFF の予約画面が
-- anon キーで直接読んでいるため、ここでは触らない（別途 Edge Function 経由に
-- 寄せる必要がある）。

drop policy if exists "Public read staff work patterns" on public.staff_work_patterns;
drop policy if exists "Public read staff special schedules" on public.staff_special_schedules;
