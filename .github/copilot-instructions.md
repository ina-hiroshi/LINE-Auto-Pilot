# LINE Auto-Pilot AI コーディング指示書

## 言語要件

- **日本語のみ**: すべてのコミュニケーション、コードコメント、ドキュメントは厳密に日本語で行うこと。会話や説明に英語を使用しないこと。

## プロジェクト概要

LINE Auto-Pilot は、LINE 自動応答、予約、ポイントシステムのための SaaS プラットフォームです。

- **スタック**: React 19 (Vite), React Router 7, Tailwind CSS 4, Lucide React, Framer Motion.
- **バックエンド**: Supabase (Auth, DB, Edge Functions).
- **連携**: LINE Messaging API, OpenAI API.

## アーキテクチャとデータフロー

- **フロントエンドファースト**: React アプリは `supabase-js` を介して Supabase DB と直接対話します。
- **認証と初期化**:
  - `frontend/src/App.tsx` で管理されます。
  - `onAuthStateChange` を監視します。
  - **重要**: ユーザーを `InitialSetup` または `Dashboard` のどちらにルーティングするかを決定するために、`stores` の存在確認 (`checkStore`) を行います。
- **マルチテナンシー**: RLS による厳密なデータ分離。テーブルは通常、`auth.uid()` にリンクされた `owner_id` を使用します。
- **Edge Functions**: LINE Webhook (`line-webhook`) やシークレットを必要とするバックエンドロジックを処理します。

## 開発ワークフロー

- **フロントエンド**: `cd frontend && npm run dev` (Vite).
- **Supabase**: ローカル開発、マイグレーション、関数のデプロイには Supabase CLI を使用します。
- **Git**: **GitHub には絶対にプッシュしないこと**。バージョン管理はユーザーが行います。

## コーディング規約

### フロントエンド (React)

- **クライアント**: `@/lib/supabase` から `supabase` をインポートします。
- **ルーティング**: React Router v7 を使用しますが、従来の `BrowserRouter`/`Routes`/`Route` コンポーネントを使用します。
- **認証**:
  - ワンショットのチェックには `supabase.auth.getUser()` を使用します。
  - **ログアウト**: `Layout.tsx` での厳密な手順: `localStorage.clear()` -> `supabase.auth.signOut()` -> `window.location.href = '/'`。
- **ナビゲーション**: ページを追加する際は `frontend/src/components/Layout.tsx` の `navItems` を更新します。
- **アイコン**: `lucide-react` のみを排他的に使用します。
- **スタイリング**:
  - Tailwind CSS 4 ユーティリティクラスを使用します。
  - **テーマカラー**: メインアクションには `primary` (Cyan/Turquoise: `#00c3dc`) を使用します。
  - 例: `text-primary-700`, `bg-primary-50`.
- **データ取得**:
  - DB 制約によって一意性が保証されていない場合は、`.maybeSingle()` ではなく `.select().eq(...).limit(1)` を優先します。
  - UI でローディング/エラー状態を明示的に処理します。

### バックエンド (Supabase)

- **RLS**: すべてのテーブルで **必須** です。ポリシーは必ず `auth.uid()` をチェックする必要があります。
- **Edge Functions**:
  - `supabase/functions/` に配置されます。
  - Deno ランタイムを使用します。
  - `line-webhook`: LINE イベントのエントリーポイントです。署名検証が必要です（TODO）。

## 主要ファイル

- `frontend/src/lib/supabase.ts`: Supabase クライアントの初期化。
- `frontend/src/App.tsx`: アプリのエントリーポイント、認証プロバイダー、ストア存在確認、ルーティング。
- `frontend/src/components/Layout.tsx`: メインレイアウト、ナビゲーション、ログアウトロジック。
- `supabase/functions/line-webhook/index.ts`: LINE Webhook ハンドラー。
- `REQUIREMENTS.md`: プロジェクト仕様とスキーマ設計。
