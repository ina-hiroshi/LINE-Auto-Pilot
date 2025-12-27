## LINE Auto-Pilot (IToguchi) 向け AI コーディング指針

- **言語**: 会話・コードコメントは日本語のみ。
- **技術構成**: React 19 + Vite 7 + React Router 7 + Tailwind CSS 4 + Lucide + Framer Motion。バックエンドは Supabase（Auth/DB/Storage/Realtime）＋ Edge Functions（Deno）。
- **開発コマンド**: `cd frontend && npm install` → `npm run dev`。ビルド `npm run build`、Lint `npm run lint`。Edge Functions デプロイ例: `supabase functions deploy line-webhook --no-verify-jwt` / `supabase functions deploy booking --no-verify-jwt`。

### ルーティング / 認証

- 認証と初期化は [frontend/src/App.tsx](frontend/src/App.tsx)。`supabase.auth.onAuthStateChange` でセッション監視し、`stores` の存在チェック後にルートを出し分け。`/booking` は常に公開、それ以外はストア未作成なら `/initial-setup` へリダイレクト。
- ログアウトは Layout/InitialSetup の流儀に合わせ「`localStorage`/`sessionStorage` クリア → supabase サインアウト → `/` リロード」。

### Supabase 利用規約

- クライアントは [frontend/src/lib/supabase.ts](frontend/src/lib/supabase.ts) の `supabase` を共有し、`import { supabase } from '@/lib/supabase'` で統一。
- DB 取得は RLS 前提。`stores.owner_id = auth.uid()` を基点に `store_id` / `line_account_id` でスコープ。
- Edge Functions 呼び出しは `supabase.functions.invoke('booking', { body: { action: ... } })` パターンを踏襲（予約取得/更新/キャンセル、空き枠計算、顧客チェックなど）。
- Google 連携時は常に Authorization ヘッダーへ `session.access_token` を付与（例: `fetch(.../google-auth|google-calendar, { headers: { Authorization: Bearer }})`）。

### 予約管理 UI（管理画面）

- [frontend/src/pages/Reservations.tsx](frontend/src/pages/Reservations.tsx): `reservations` を `store_id` で絞り、`customers` と突合。`staff_members`/`booking_menus` を外部キーで join 済み。
- Supabase Realtime channel 名は `reservations-realtime`。`postgres_changes` で `store_id` フィルターし、全イベントで `fetchReservations()` を再実行。
- Google カレンダー: `google-auth` GET で認可 URL、POST で code 交換し `google_calendar_settings` に保存。`google-calendar` GET で `action=list_calendars|list_events`。`redirect_uri` は現ページ（/reservations）。

### 予約フロー（LIFF 公開画面）

- [frontend/src/pages/Booking.tsx](frontend/src/pages/Booking.tsx): LIFF で動く公開予約。`VITE_LIFF_ID` 必須。非 LINE or DEV ではモックユーザで代替。
- `store_id` は query param 優先、無ければ最初のストアを取得して設定も読み込む（`name`/`liff_template_id`/`liff_theme_color`/`booking_system_type` など）。
- `booking_system_type` により初期ステップを切替（generic→date, salon→staff_select, restaurant→menu_select）。
- スタッフ/メニューは [frontend/src/hooks/useStoreResources.ts](frontend/src/hooks/useStoreResources.ts) の `refreshResources()`（`staff_members`/`booking_menus` を is_active で絞り）を利用。
- 空き枠取得・予約作成/更新/キャンセルは Edge Function `booking` の `action` を切り替えて実行。既存予約がある場合 `existing_reservation` ステップへ遷移。
- 親ウィンドウ（管理画面）からの設定更新は `window.postMessage` の `UPDATE_SETTINGS` を受信し、UI 状態を即時反映。

### LINE Webhook / 自動応答

- [supabase/functions/line-webhook/index.ts](supabase/functions/line-webhook/index.ts): `destination` で `line_accounts` を特定し、DB から `channel_secret`/`channel_access_token` を取得。Web Crypto API による HMAC-SHA256 検証後、`auto_responses` をスコアリングし、応答ログは `customer_logs` へ保存。
- [supabase/functions/booking/index.ts](supabase/functions/booking/index.ts): LINE 予約受付・変更・キャンセル API。`line_accounts` から `line_account_id` を引き、`customers` upsert → `reservations` CRUD。キャンセルは status `cancelled` に更新するだけ。時間は JST (+09:00) で ISO 文字列化。
- Google 連携関数: [supabase/functions/google-auth/index.ts](supabase/functions/google-auth/index.ts) で token 取得保存、[supabase/functions/google-calendar/index.ts](supabase/functions/google-calendar/index.ts) で token 更新とリスト取得。全関数で CORS/OPTIONS を実装。

### デザイン / UI トーン

- Tailwind 4 ユーティリティベースで `primary (#00c3dc)` を軸に配色。アイコンは Lucide のみ。必要に応じて Framer Motion でローディング等に動きを付ける。
- 共通 UI: モーダル [frontend/src/components/Modal.tsx](frontend/src/components/Modal.tsx)、トースト [frontend/src/components/Toast.tsx](frontend/src/components/Toast.tsx)、LIFF 用モーダル/トーストは `components/liff/` 配下を再利用。

### ナレッジ

- 主要ルート: `/` Dashboard, `/reservations`, `/line-settings`, `/auto-responses`, `/customers`, `/dev`, `/booking`（公開）, `/initial-setup`。
- 仕様・データモデルの全体像は [REQUIREMENTS.md](REQUIREMENTS.md) を参照。マイグレーションは `supabase/migrations/` を参照してフィールド追加の整合を取る。
