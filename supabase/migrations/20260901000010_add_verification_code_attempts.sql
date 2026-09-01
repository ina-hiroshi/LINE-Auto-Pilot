-- verify-code は email + code の完全一致でしかコードを引いておらず、
-- 試行回数の記録も上限も無かった。6桁(10万〜99万9999、約90万通り)の
-- コードは有効期限15分の間、何度でも総当たりで試せる状態だった。
-- 成立してしまうと、他人のメールアドレスで signUp が走ってしまう
-- （新規登録の先取り。既存アカウントの乗っ取りではないが、
-- 本人が先に登録できなくなる実害がある）。
--
-- 試行回数を記録し、Edge Function 側で一定回数を超えたら
-- そのコードを無効化する（新しいコードの再送信を要求する）ようにする。

alter table public.verification_codes
  add column if not exists attempts integer not null default 0;
