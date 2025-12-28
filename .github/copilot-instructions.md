## LINE Auto-Pilot (IToguchi) 向け AI コーディング指針

- **言語**: 会話・コードコメントは日本語のみ。
- **技術構成**: React 19 + Vite 7 + React Router 7 + Tailwind CSS 4 + Lucide + Framer Motion。バックエンドは Supabase（Auth/DB/Storage/Realtime）＋ Edge Functions（Deno）。
- **開発コマンド**: `cd frontend && npm install` → `npm run dev`。ビルド `npm run build`、Lint `npm run lint`。
- **デプロイ**: `supabase functions deploy [function-name] --no-verify-jwt`。

### アーキテクチャ・データフロー

- **認証**: [frontend/src/App.tsx](frontend/src/App.tsx) で `supabase.auth.onAuthStateChange` を監視。`/booking` は公開ルート、それ以外は `stores` 未作成なら `/initial-setup` へ誘導。
- **データアクセス**:
  - クライアント: `import { supabase } from '@/lib/supabase'` を使用。RLS により `stores.owner_id = auth.uid()` で自動フィルタリング。
  - サーバーサイド: Edge Functions は `supabase-js` を使用。`booking` 関数などは `service_role` キーが必要な場合あり（管理者権限での操作）。
- **状態管理**: グローバルステートは最小限。基本は React Query や `useEffect` + Supabase Realtime でサーバー状態と同期。

### Edge Functions (API)

`supabase.functions.invoke('function-name', { body: { ... } })` で呼び出し。

- **booking**: 予約システムの核。`action` パラメータで分岐。
  - `check_customer`: 顧客存在確認
  - `get_active_reservation`: 有効な予約取得
  - `get_available_slots`: 空き枠計算
  - `create_reservation` / `update_reservation` / `cancel_reservation`: 予約操作
- **line-webhook**: LINE からのイベント受信。署名検証 → 自動応答判定 → `customer_logs` 保存。
- **manual-reply**: 管理画面からの手動返信。`messageLogId`, `replyText`, `userId` を受け取り LINE Messaging API を叩く。
- **apply-rich-menu**: リッチメニューの生成・適用。`store_id`, `generated_image_url`, `liff_id` を使用。
- **google-auth / google-calendar**: Google 連携用。OAuth フローとカレンダー同期。

### フロントエンド実装規約

- **コンポーネント**: `frontend/src/components` (共通), `frontend/src/features` (機能別), `frontend/src/pages` (ページ)。
- **スタイリング**: Tailwind CSS 4。色は `primary (#00c3dc)` を基調。アイコンは `lucide-react`。
- **予約管理 (Reservations.tsx)**:
  - `reservations-realtime` チャンネルで `postgres_changes` を監視し、予約変更を即座に反映。
  - 外部キー結合 (`staff_members`, `booking_menus`, `customers`) 済みのデータを扱う。
- **LIFF 予約 (Booking.tsx)**:
  - `booking_system_type` (generic/salon/restaurant) に応じてステップを動的に切り替え。
  - `window.postMessage` で親ウィンドウ（管理画面プレビュー）からの設定変更を即時反映。

### テスト・検証 (REGRESSION_CHECKLIST 準拠)

変更時は以下を意識して実装・検証する：
1. **予約導線**: ログイン → 設定取得 → 枠取得 → 予約確定 まで通るか。
2. **リアルタイム性**: 管理画面を開いた状態で予約が入った際、リロードなしで反映されるか。
3. **LINE 連携**: Webhook が 200 を返し、自動応答またはログ保存が行われるか。
4. **Google 連携**: 認可フローが完了し、カレンダー設定が保存されるか。

### 関連ファイル

- 仕様詳細: [REQUIREMENTS.md](REQUIREMENTS.md)
- テスト項目: [REGRESSION_CHECKLIST.md](REGRESSION_CHECKLIST.md)
- DB 定義: `supabase/migrations/`
