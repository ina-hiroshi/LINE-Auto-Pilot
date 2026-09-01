-- reservations には store_id ベースの authenticated 向けポリシー
-- （SELECT/INSERT/UPDATE/DELETE、いずれも stores.owner_id = auth.uid() で判定）
-- とは別に、"Users can manage their own reservations" という role=public・ALL の
-- 旧ポリシーが残っていた。こちらは line_account_id -> line_accounts.user_id を
-- 経由して同じ意図（自分の予約だけ操作できる）を実現しようとしたもの。
--
-- 現状の line_accounts.user_id は全行 stores.owner_id と一致しており、
-- 今すぐ悪用できる状態ではない。ただしこの一致はデータの整合性に依存した
-- 偶然の安全であり、将来 line_accounts.user_id と stores.owner_id が
-- （店舗の譲渡・管理者による代行設定・不具合等で）食い違えば、
-- このポリシーだけが独自に有効な認可経路として残ってしまう。
-- アプリコードも line_account_id を認可判定には使っていない
-- （予約作成時に書き込むだけ）。
--
-- store_id ベースのポリシーで必要な操作はすべて賄えるため、
-- 二重の認可経路をなくして片方だけに寄せる。

drop policy if exists "Users can manage their own reservations" on public.reservations;
