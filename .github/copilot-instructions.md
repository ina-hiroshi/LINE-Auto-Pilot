## LINE Auto-Pilot (IToguchi) 向け AI コーディング指針

- **言語**: 会話・コードコメントともに日本語のみ。
- **技術構成**: React 19 + Vite 7、React Router 7、Tailwind CSS 4、Lucide、Framer Motion。バックエンドは Supabase（Auth/DB/Storage/Realtime）＋ Edge Functions（Deno）。
- **開発コマンド**: `cd frontend && npm install` → `npm run dev`。ビルドは `npm run build`、Lint は `npm run lint`。Edge Functions デプロイ例: `supabase functions deploy line-webhook --no-verify-jwt`、`supabase functions deploy booking --no-verify-jwt`。

### フロントエンドの約束事

- Supabase クライアントは [frontend/src/lib/supabase.ts](frontend/src/lib/supabase.ts) の `supabase` を使用し、`import { supabase } from '@/lib/supabase'` で統一。
- 認証と初期化は [frontend/src/App.tsx](frontend/src/App.tsx) が担当。`supabase.auth.onAuthStateChange` でセッションを監視し、`stores` の存在チェック後にルーティングを切り替える（/booking はログイン不要、それ以外はストア未作成で /initial-setup へ）。
- ログアウト手順は Layout/InitialSetup に合わせて「`localStorage`/`sessionStorage` クリア → `supabase.auth.signOut()` → `/` へリロード」。
- 予約画面 [frontend/src/pages/Reservations.tsx](frontend/src/pages/Reservations.tsx) は `reservations` テーブルを `store_id` で絞り込み、`customers`/`staff_members`/`booking_menus` を突合。Supabase Realtime channel `reservations-realtime` で即時反映。
- Google カレンダー連携は同ページから Edge Function `google-auth`/`google-calendar` を呼び出す。redirect_uri は現在ページを利用し、Authorization ヘッダーに `session.access_token` を付与する前提。
- UI は Tailwind 4 ユーティリティ + `primary(#00c3dc)` トーンを優先。アイコンは Lucide のみ。アニメーションは Framer Motion を適宜使用。

### バックエンド / Edge Functions の要点

- `line-webhook` [supabase/functions/line-webhook/index.ts](supabase/functions/line-webhook/index.ts): `destination`（Bot User ID）で `line_accounts` を特定し、DB から `channel_secret`/`channel_access_token` を取得。Web Crypto API で HMAC-SHA256 署名検証後に自動応答ルール `auto_responses` をスコアリング。応答ログは `customer_logs` へ記録。
- `booking` [supabase/functions/booking/index.ts](supabase/functions/booking/index.ts): LINE 予約受付・変更・キャンセル。`line_accounts` から `line_account_id` を引き、`customers` を upsert してから `reservations` を作成/更新。キャンセルは status を `cancelled` に更新するだけ。時間は JST (+09:00) 前提で ISO 文字列化。
- `google-auth` [supabase/functions/google-auth/index.ts](supabase/functions/google-auth/index.ts): GET で認可 URL を返却、POST で code を refresh_token に交換し `google_calendar_settings` に保存。`Authorization` ヘッダーのユーザコンテキストで動く。
- `google-calendar` [supabase/functions/google-calendar/index.ts](supabase/functions/google-calendar/index.ts): refresh_token を使って access token を更新し、`action` クエリでカレンダー一覧/イベント一覧を返却。
- Edge Functions はすべて CORS ヘッダーを明示し、OPTIONS も処理。環境変数は `Deno.env.get` で取得。

### データモデルとマルチテナンシー

- RLS 前提。`stores.owner_id = auth.uid()` を起点に、各テーブルは `store_id` または `line_account_id` でスコープ。LINE Webhook では `destination → line_accounts → store_id` でテナントを分岐。
- 主なテーブル: `stores`（店舗・owner_id）, `profiles`, `line_accounts`（line_user_id で webhook 宛先判定）, `auto_responses`, `reservations`（start/end_time・status・memo・staff/menu FK）, `customers`, `google_calendar_settings`。

### エラーハンドリングとパターン

- Supabase エラーは `error instanceof Error ? error.message : (error as any)?.message || '不明なエラー'` 形式でメッセージ化し、Toast/Modal で通知する流儀。
- API 呼び出し時は Authorization ヘッダーに `session.access_token` を付与する前提。特に Edge Functions の Google 連携はこれが必須。
- `.maybeSingle()` と `.limit(1)` が混在する。既存実装に合わせて踏襲しつつ、一意性が曖昧な場合は `.limit(1)` を検討。

### 覚えておくと速いこと

- ルート構成: `/`=Dashboard, `/reservations`, `/line-settings`, `/auto-responses`, `/customers`, `/dev`, `/booking`（公開）, `/initial-setup`（初期登録）。
- 画像・アイコンは `frontend/src/assets/`、共通モーダル/トーストは `components/Modal.tsx` / `components/Toast.tsx` を再利用。
- DB・仕様の全体像は [REQUIREMENTS.md](REQUIREMENTS.md) に集約。必要なフィールドやフローはここを参照。
