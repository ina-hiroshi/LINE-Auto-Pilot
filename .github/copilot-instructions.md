# LINE Auto-Pilot AI コーディング指示書

あなたは「LINE Auto-Pilot」プロジェクトの専門開発者です。
このプロジェクトは、LINE 公式アカウントの運用を自動化し、予約・顧客・ポイント管理を一元化する SaaS プラットフォームです。
一貫性と品質を保つため、以下の指示に従ってください。

## 1. プロジェクトの背景と技術スタック

- **言語**: 日本語（会話およびコメント）。
- **フロントエンド**: React 19, Vite 7, React Router 7, Tailwind CSS 4。
  - **UI**: Lucide React (アイコン), Framer Motion (アニメーション)。
  - **LIFF**: `@line/liff` (LINE Front-end Framework)。
  - **QR/画像**: `jsqr` (読み取り), `html2canvas` (生成)。
  - **ドキュメント処理**: `mammoth` (.docx), `pdfjs-dist` (.pdf) - AI 学習用データ抽出に使用。
- **バックエンド**: Supabase (PostgreSQL, Auth, Storage, Realtime)。
  - **ロジック**: Supabase Edge Functions (Deno)。
  - **共通処理**: `supabase/functions/_shared/` (例: `line-auth.ts`, `supabase-client.ts`)。
- **インフラ**: Vercel (フロントエンド), Supabase (バックエンド)。

## 2. アーキテクチャとデータフロー

- **認証 & マルチテナント**:

  - **認証**: `TopPage.tsx` でログイン/サインアップ。
  - **RLS (Row Level Security)**: `stores` テーブルの `owner_id` と `auth.uid()` を照合し、データアクセスを厳格に分離。
  - **公開ルート**: `/booking`, `/member-card` は `store_id` (UUID) でアクセス制御（認証なしで閲覧可能）。

- **予約システム (Google Calendar Hub)**:

  - **Source of Truth**: Google カレンダーを「正」とする。
  - **同期フロー**:
    1.  **LINE/Web 予約**: `booking` 関数 -> Google Calendar API (Insert) -> Supabase (Insert)。
    2.  **Google 変更**: Google Webhook -> `google-calendar-webhook` 関数 -> Supabase (Upsert/Delete)。
    3.  **増分同期**: `sync_token` を使用して差分のみを取得・反映。

- **AI チャットボット (RAG)**:

  - **データソース**: `ai_knowledge` テーブル (店舗ごとの知識ベース)。
  - **処理**: `fetch-url-content` で Web ページ等の内容を取得し、Embedding して検索（予定）。
  - **対話**: `ai-chat-preview` で回答生成をテスト。

- **リアルタイム更新**:
  - `supabase.channel` を使用して `postgres_changes` をリッスン。
  - 対象: `reservations` (予約表), `customer_logs` (チャットログ), `points` (ポイント更新)。

## 3. ディレクトリ構造と主要ファイル

- **フロントエンド (`frontend/src/`)**:

  - `features/`: 機能ごとのドメインロジック (例: `line-settings`, `calendar`, `ai-settings`)。
  - `lib/supabase.ts`: Supabase クライアント初期化。
  - `hooks/`: カスタムフック (例: `useProfile`, `useReservations`)。

- **Edge Functions (`supabase/functions/`)**:
  - `line-webhook`: LINE Messaging API からのイベント受信・処理。
  - `google-calendar-webhook`: Google Calendar からの変更通知受信。
  - `booking`: 予約の空き枠計算・作成・キャンセル。
  - `apply-rich-menu`: リッチメニューの生成と LINE API への適用。
  - `ai-chat-preview`: AI 回答のプレビュー生成。

## 4. データモデル (主要テーブル)

- **コア**: `stores` (店舗設定), `line_accounts` (LINE 認証情報)。
- **予約**: `reservations` (予約本体), `reservation_details` (詳細), `salon_tables` (座席/リソース)。
- **顧客**: `customers` (顧客情報), `customer_logs` (メッセージ履歴), `points` (ポイント残高)。
- **AI**: `ai_knowledge` (学習データ), `ai_threads` (会話スレッド), `ai_messages` (会話履歴)。
- **設定**: `auto_responses` (キーワード応答), `membership_card_settings` (会員証デザイン)。

## 5. 開発ワークフロー

- **フロントエンド起動**: `cd frontend && npm run dev`
- **関数デプロイ**: `supabase functions deploy [name] --no-verify-jwt`
  - 環境変数は `supabase secrets set` で管理。
- **DB マイグレーション**: `supabase/migrations/` に SQL ファイルを配置。
  - 変更後は `supabase db reset` または `supabase db push` (ローカル開発時)。
- **Lint**: `cd frontend && npm run lint` (ESLint 9)。

## 6. コーディング規約と注意点

- **スタイリング**: Tailwind CSS 4 を使用。メインカラー: `#00c3dc` (LINE Green 近似)。
- **状態管理**: React Query (TanStack Query) ではなく、シンプルな `useEffect` + `useState` または Supabase Realtime を活用。
- **エラーハンドリング**: ユーザー向けのエラーは `alert` ではなく、トースト通知や `Modal.tsx` を使用。
- **環境変数**:
  - フロントエンド: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`。
  - Edge Functions: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LINE_CHANNEL_ACCESS_TOKEN` 等。

## 7. 検証チェックリスト (REGRESSION_CHECKLIST)

タスク完了前に以下を確認すること:

1. **予約同期**: Google カレンダー側での変更が管理画面に反映されるか。
2. **LINE 応答**: Webhook が正常に動作し、自動応答/AI 応答が返るか。
3. **会員証**: LIFF 上で QR コードが表示され、読み取りでポイントが付与されるか。
4. **リアルタイム**: 別のブラウザ/タブで操作した内容が即座に反映されるか。
