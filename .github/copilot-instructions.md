## LINE Auto-Pilot (IToguchi) 向け AI コーディング指針

- **言語**: 会話・コードコメントは日本語のみ。
- **技術構成**: React 19 + Vite 7 + React Router 7 + Tailwind CSS 4 + Lucide + Framer Motion。バックエンドは Supabase（Auth/DB/Storage/Realtime）＋ Edge Functions（Deno）。
- **開発コマンド**: `cd frontend && npm install` → `npm run dev`。ビルド `npm run build`、Lint `npm run lint`。
- **デプロイ**: `supabase functions deploy [function-name] --no-verify-jwt`。

### アーキテクチャ・データフロー

- **認証**: [frontend/src/App.tsx](frontend/src/App.tsx) で `supabase.auth.onAuthStateChange` を監視。
  - **公開/LIFF**: `/booking`, `/member-card` は認証不要。
  - **管理画面**: 認証必須。`stores` 未作成なら `/initial-setup` へ誘導。
- **データアクセス**:
  - クライアント: `import { supabase } from "@/lib/supabase"` を使用。RLS により `stores.owner_id = auth.uid()` で自動フィルタリング。
  - サーバーサイド: Edge Functions は `supabase-js` を使用。`service_role` キーが必要な操作（LINE Webhook 等）はサーバー側で完結させる。
- **状態管理**:
  - グローバルステートは最小限。`useEffect` + `useState` でデータ取得。
  - リアルタイム更新は `supabase.channel` で `postgres_changes` を監視し、DB の変更を即座に UI に反映。

### Edge Functions (API)

`supabase.functions.invoke("function-name", { body: { ... } })` で呼び出し。

- **booking**: 予約システムの核。`check_customer`, `get_available_slots`, `create_reservation` 等のアクションを処理。
- **line-webhook**: LINE Messaging API からのイベント受信。署名検証 → 自動応答/ログ保存。
- **manual-reply**: 管理画面からの手動返信。
- **apply-rich-menu**: リッチメニューの生成・適用。
- **google-auth / google-calendar**: Google カレンダー連携（OAuth, 同期）。
- **get-liff-customer**: LIFF アプリでの顧客情報取得。
- **get-line-bot-info / get-line-quota**: LINE 公式アカウント情報の取得。

### フロントエンド実装規約

- **ディレクトリ構成**:
  - `pages/`: ルーティングに対応するページコンポーネント。
    - 管理画面: `Dashboard`, `Reservations`, `MembershipCard` 等。
    - LIFF/公開: `Booking`, `MemberCardLIFF`。
  - `components/`: 再利用可能な UI 部品。
  - `features/`: 機能単位のロジック（例: `line-settings`）。
- **スタイリング**: Tailwind CSS 4。色は `primary (#00c3dc)` を基調。アイコンは `lucide-react`。
- **会員証・ポイント機能**:
  - `MembershipCard.tsx` (管理画面) と `MemberCardLIFF.tsx` (ユーザー画面) で構成。
  - 設定は `stores` テーブルの JSON カラム (`membership_card_settings`, `membership_rank_settings`) に保存。

### テスト・検証 (REGRESSION_CHECKLIST 準拠)

変更時は以下を意識して実装・検証する：
1. **予約導線**: ログイン → 設定取得 → 枠取得 → 予約確定 まで通るか。
2. **リアルタイム性**: 管理画面を開いた状態で予約が入った際、リロードなしで反映されるか。
3. **LINE 連携**: Webhook が 200 を返し、自動応答またはログ保存が行われるか。
4. **Google 連携**: 認可フローが完了し、カレンダー設定が保存されるか。
5. **会員証**: デザイン設定の変更が LIFF 画面に即座に反映されるか。

### 関連ファイル

- 仕様詳細: [REQUIREMENTS.md](REQUIREMENTS.md)
- テスト項目: [REGRESSION_CHECKLIST.md](REGRESSION_CHECKLIST.md)
- DB 定義: `supabase/migrations/`
