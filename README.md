# LINE Auto-Pilot

LINE 公式アカウントの運用を自動化し、予約・顧客管理・ポイントシステムを一元管理する SaaS プラットフォーム。

## 特徴

- **完全自動化**: LINE Messaging API と連携し、24 時間 365 日自動で応答。
- **予約管理**: Google カレンダーと双方向同期し、ホットペッパー等の外部サイトとのダブルブッキングを防止。
- **マルチテナント**: 1 つのシステムで複数の店舗（LINE アカウント）を管理。
- **No-Code**: 専門知識不要で、Web 管理画面からすべての設定が可能。

## アーキテクチャ

### フロントエンド

- **Framework**: React 19 (Vite)
- **UI Library**: Tailwind CSS 4, Lucide React
- **Hosting**: Vercel

### バックエンド

- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (RLS によるデータ分離)
- **Logic**: Supabase Edge Functions (Deno)

### 予約同期システム (Google Calendar Hub)

1. **Hub 戦略**: Google カレンダーを「正」とし、全ての予約情報を集約。
2. **リアルタイム同期**: Google Calendar API の Watch 機能（Webhook）により、外部からの予約を即座に検知。
3. **永続的な接続**: OAuth 2.0 (`access_type=offline`) によりリフレッシュトークンを取得し、バックグラウンドで同期を継続。

## 開発環境セットアップ

1. **依存関係のインストール**

   ```bash
   cd frontend
   npm install
   ```

2. **環境変数の設定**
   `.env.local` を作成し、Supabase の URL と Anon Key を設定。

3. **開発サーバー起動**
   ```bash
   npm run dev
   ```

## ディレクトリ構成

- `frontend/`: React アプリケーション
- `supabase/`: データベース定義、Edge Functions
  - `functions/line-webhook/`: LINE Webhook ハンドラー
  - `migrations/`: データベースマイグレーションファイル
