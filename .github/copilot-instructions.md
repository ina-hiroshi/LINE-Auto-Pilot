# LINE Auto-Pilot (IToguchi) AI コーディング指示書

## 言語要件

- **日本語のみ**: すべてのコミュニケーション、コードコメント、ドキュメントは厳密に日本語で行うこと。会話や説明に英語を使用しないこと。

## プロジェクト概要

LINE Auto-Pilot (IToguchi) は、LINE 自動応答、予約、ポイントシステムのための SaaS プラットフォームです。

- **スタック**: React 19 (Vite 7), React Router 7, Tailwind CSS 4, Lucide React, Framer Motion.
- **バックエンド**: Supabase (Auth, DB, Edge Functions).
- **連携**: LINE Messaging API, OpenAI API, Google Calendar API.

## アーキテクチャとデータフロー

- **フロントエンドファースト**: React アプリは `supabase-js` を介して Supabase DB と直接対話します。
- **認証と初期化**:
  - `frontend/src/App.tsx` で管理されます。
  - `onAuthStateChange` を監視し、`stores` テーブルの存在確認 (`checkStore`) を行います。
  - **ルーティング**: ストア未作成のユーザーは `InitialSetup` へ、作成済みは `Dashboard` へ誘導します。
- **マルチテナンシー**: RLS (Row Level Security) による厳密なデータ分離。
  - `stores` テーブルは `owner_id` = `auth.uid()` で紐付け。
  - 他のテーブルは `store_id` または `line_account_id` を介して所有権を管理。
- **Edge Functions**:
  - `line-webhook`: LINE イベントのエントリーポイント。`destination` (Bot User ID) を基にテナントを特定し、適切なアクセストークンで応答します。
  - その他、Google Calendar 同期や OpenAI 連携など、シークレットを要する処理を担当。

## 開発ワークフロー

- **フロントエンド**: `cd frontend && npm run dev` (Vite).
- **Supabase**:
  - ローカル開発、マイグレーション、関数のデプロイには Supabase CLI を使用。
  - デプロイ例: `supabase functions deploy line-webhook --no-verify-jwt`
- **Git**: **GitHub には絶対にプッシュしないこと**。バージョン管理はユーザーが行います。

## コーディング規約

### フロントエンド (React)

- **クライアント**: `@/lib/supabase` から `supabase` をインポートします。
- **ルーティング**: React Router v7 を使用しますが、`BrowserRouter`/`Routes`/`Route` コンポーネントによる構成を維持します。
- **認証**:
  - ワンショットのチェックには `supabase.auth.getUser()` を使用。
  - **ログアウト**: `Layout.tsx` での手順: `localStorage.clear()` -> `supabase.auth.signOut()` -> `window.location.href = '/'`。
- **エラーハンドリング**:
  - Supabase のエラーオブジェクトを適切に処理すること。
  - 例: `const message = error instanceof Error ? error.message : (error as any)?.message || '不明なエラー'`
- **スタイリング**:
  - Tailwind CSS 4 ユーティリティクラスを使用。
  - **テーマカラー**: `primary` (Cyan/Turquoise: `#00c3dc`) を使用 (例: `text-primary-700`, `bg-primary-50`)。
- **アイコン**: `lucide-react` のみを排他的に使用。
- **データ取得**:
  - 一意性が保証されていない検索には `.maybeSingle()` ではなく `.select().eq(...).limit(1)` を優先。

### バックエンド (Supabase)

- **RLS**: すべてのテーブルで **必須**。ポリシーは必ず `auth.uid()` に基づく所有権チェックを含むこと。
- **Edge Functions (Deno)**:
  - `supabase/functions/` に配置。
  - `line-webhook` では Web Crypto API を使用して署名検証を行う (Node.js 固有の `crypto` モジュールは使用不可)。
  - 環境変数は `Deno.env.get()` で取得。

## 主要ファイル

- `frontend/src/lib/supabase.ts`: Supabase クライアント初期化。
- `frontend/src/App.tsx`: 認証状態監視、ストア存在確認、ルーティング分岐。
- `frontend/src/components/Layout.tsx`: メインレイアウト、ナビゲーション。
- `supabase/functions/line-webhook/index.ts`: LINE Webhook ハンドラー (署名検証、テナント特定、応答)。
- `REQUIREMENTS.md`: プロジェクト仕様、DB スキーマ定義。
