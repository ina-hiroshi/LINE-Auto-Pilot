# LINE予約システム ロジック・セキュリティ評価レポート

評価日: 2025年1月
評価対象: LINE予約システム（booking function, フロントエンド, データベース）

---

## 1. システム概要

### 1.1 主要コンポーネント
- **Edge Function**: `supabase/functions/booking/index.ts`
- **フロントエンド**: `frontend/src/pages/Booking.tsx`, `Reservations.tsx`
- **データベース**: `reservations`, `temporary_holds`, `customers` テーブル
- **認証**: LINE Access Token検証、Supabase Auth（手動登録用）

### 1.2 予約フロー
1. **仮押さえ（hold_slot）**: ユーザーが時間枠を選択 → 10分間の仮押さえを作成
2. **確定（create_reservation）**: ユーザー情報入力後、確定予約を作成
3. **Google Calendar連携**: 仮押さえ・確定予約をGoogle Calendarに同期

---

## 2. ロジック評価

### 2.1 ✅ 良好な点

#### 仮押さえメカニズム
- **10分間の有効期限**: 仮押さえは10分で自動期限切れ（`expires_at`）
- **Google Calendar連携**: 仮押さえもGoogle Calendarに反映され、視覚的に確認可能
- **重複防止**: 同一ユーザーの既存仮押さえを削除してから新しい仮押さえを作成

```typescript:266-354:supabase/functions/booking/index.ts
// 既存の仮押さえを削除してから新しい仮押さえを作成
await supabaseClient.from('temporary_holds').delete()...
```

#### 時間枠計算
- **営業時間の考慮**: 曜日別営業時間、特別営業日、臨時休業日の処理
- **スタッフ勤務時間**: スタッフ指定時はスタッフの勤務時間を考慮
- **メニュー別時間**: メニューごとの所要時間（`duration_minutes`）を考慮

#### 容量管理
- **店舗レベル**: `capacity_per_slot` で同時予約可能数を設定
- **メニューレベル**: メニューごとの容量設定に対応
- **スタッフ指定**: スタッフ指定時は1人まで（同時に1件のみ）

#### 重複チェック
- **確定予約**: `status != 'cancelled'` の予約をチェック
- **仮押さえ**: 有効期限内（`expires_at > now()`）の仮押さえをチェック
- **Google Calendar**: 外部カレンダーイベントも考慮
- **自分の予約は除外**: 自分の仮押さえ・仮予約は重複チェックから除外

### 2.2 ⚠️ 改善が必要な点

#### レースコンディション（Race Condition）

**問題**: `create_reservation` と `update_reservation` で、容量チェックと予約作成の間にタイムラグがあり、同時リクエストで重複予約が発生する可能性があります。

```typescript:1002-1036:supabase/functions/booking/index.ts
// 容量チェック
const { data: overlapReservations } = await overlapQuery
// ... チェック処理 ...
// この間に別のリクエストが同じ枠を予約できる可能性
const { data: newReservation } = await supabaseClient.from('reservations').insert(...)
```

**影響**: 
- 2人のユーザーが同時に同じ時間枠を予約すると、両方とも成功する可能性
- 特に人気の時間帯で問題が発生しやすい

**推奨対策**:
1. **データベーストランザクション + 排他ロック**: 
   ```sql
   BEGIN;
   SELECT * FROM reservations WHERE ... FOR UPDATE;
   -- 容量チェック
   INSERT INTO reservations ...;
   COMMIT;
   ```
2. **ユニーク制約**: `(store_id, start_time, end_time, staff_id)` にユニーク制約を追加（ただし、容量 > 1 の場合は複数予約が必要なため注意）
3. **楽観的ロック**: バージョン番号を使用

#### 仮押さえの期限切れ処理

**現状**: `get_available_slots` アクション内で、期限切れの仮押さえを自動的に削除する仕組みが実装されています。

```typescript:393-424:supabase/functions/booking/index.ts
// --- 期限切れの仮予約を削除（Google Calendarからも削除）---
const { data: expiredHolds } = await supabaseClient
  .from('temporary_holds')
  .select('id, google_event_id, store_id')
  .lt('expires_at', new Date().toISOString())
// ... Google Calendarイベントも削除 ...
// DBから期限切れの仮予約を削除
```

**評価**: 
- 誰かが予約画面の日時選択を開いたときに自動的にクリーンアップされるため、実用的で効率的
- 定期的なCron Jobがなくても、ユーザーアクションに応じて自動的にクリーンアップされる
- Google Calendarの仮予約イベントも同時に削除されるため、整合性が保たれている

**結論**: 現状の実装で問題なし。追加の改善は不要。

#### 日付・時間の検証不足

**問題**: 入力された日付・時間の妥当性チェックが不十分です。

```typescript:981:supabase/functions/booking/index.ts
const startDateTime = new Date(`${date}T${time}:00+09:00`)
```

**リスク**:
- 過去の日付を予約できる
- 無効な日付形式（例: `2025-13-45`）がエラーになるが、適切なエラーメッセージがない
- 営業時間外の時間を予約できる可能性

**推奨対策**:
```typescript
// 日付検証
const startDateTime = new Date(`${date}T${time}:00+09:00`)
if (isNaN(startDateTime.getTime())) {
  throw new Error('無効な日付・時間です')
}
if (startDateTime < new Date()) {
  throw new Error('過去の日付は予約できません')
}
// 最大予約日数チェック
const maxDays = storeSettings.max_booking_days ?? 60
const maxDate = new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000)
if (startDateTime > maxDate) {
  throw new Error(`予約可能日は${maxDays}日後までです`)
}
```

#### 時間帯の重複判定ロジック

**現状**: `isOverlapping` 関数で時間帯の重複を判定していますが、境界条件の確認が必要です。

```typescript:34:supabase/functions/booking/index.ts
const isOverlapping = (startA: Date, endA: Date, startB: Date, endB: Date) => startA < endB && endA > startB
```

**確認事項**: 
- `startA === endB` や `endA === startB` の場合は重複しない（正しい）
- ただし、`startA < endB` と `endA > startB` の両方が必要（正しい実装）

**推奨**: 単体テストで境界条件を確認

---

## 3. セキュリティ評価

### 3.1 ✅ 良好な点

#### LINE Access Token検証
- **トークン検証**: LINE API (`/oauth2/v2.1/verify`) でトークンの有効性を確認
- **Channel ID検証**: クロスチャネル攻撃を防止（別チャネルのトークンを使用できない）
- **ユーザーIDの確定**: リクエストボディの `line_user_id` を盲信せず、トークンから取得した `userId` を使用

```typescript:2-39:supabase/functions/_shared/line-auth.ts
export async function verifyLineToken(accessToken: string, expectedChannelId?: string) {
  // トークン検証
  // Channel ID検証
  // プロフィール取得
}
```

#### IDOR対策
- **予約キャンセル**: 自分の予約のみキャンセル可能
- **予約更新**: 自分の予約のみ更新可能

```typescript:693-695:supabase/functions/booking/index.ts
if (!isManualRegistration && reservation.line_user_id !== line_user_id) {
  throw new Error('Unauthorized: You can only cancel your own reservations')
}
```

#### Row Level Security (RLS)
- **reservations**: オーナーのみアクセス可能
- **customers**: オーナーのみアクセス可能
- **temporary_holds**: サービスロールで管理（Edge Function経由）

```sql:18-28:supabase/migrations/20251225000002_fix_reservations_table.sql
create policy "Users can view their own store's reservations"
    on public.reservations for select
    using (store_id in (select id from public.stores where owner_id = auth.uid()))
```

#### 手動登録時の認証
- **Supabase Auth**: 管理画面からの手動登録時は `authorization` ヘッダーで認証
- **オーナー確認**: 店舗のオーナーのみ手動登録可能

```typescript:171-190:supabase/functions/booking/index.ts
if (is_manual === true) {
  const authHeader = req.headers.get('authorization')
  // ... オーナー確認 ...
}
```

### 3.2 ⚠️ 改善が必要な点

#### 認証の抜け漏れ

**問題1: `check_customer` と `get_active_reservation` の認証不要**

```typescript:228-233:supabase/functions/booking/index.ts
// check_customer, get_active_reservation は認証なしでも許可（読み取りのみ、line_user_idが一致すれば問題ない）
const sensitiveActions = ['create_reservation', 'cancel_reservation', 'update_reservation'];
if (sensitiveActions.includes(action) && !verifiedUserId && !isManualRegistration) {
  throw new Error('Unauthorized: Valid Access Token is required for this action');
}
```

**リスク**: 
- 任意の `line_user_id` を指定して他人の顧客情報・予約情報を取得できる可能性
- ただし、RLSにより `reservations` テーブルは直接アクセスできないため、実際のリスクは低い

**推奨対策**:
- `check_customer` と `get_active_reservation` でも `line_user_id` の検証を必須にする
- または、`line_user_id` が `U` で始まる場合のみ許可（LIFFからのアクセスと判断）

**問題2: `get_available_slots` の認証不要**

```typescript:390:supabase/functions/booking/index.ts
if (action === 'get_available_slots') {
```

**評価**: 
- 公開情報（営業時間、空き枠）の取得のため、認証不要は妥当
- ただし、`line_user_id` が指定されている場合、自分の仮押さえを除外するため、`line_user_id` の検証を推奨

#### 入力検証の不足

**問題1: SQLインジェクション対策**

**評価**: Supabaseクライアントを使用しているため、パラメータ化クエリによりSQLインジェクションのリスクは低い。ただし、以下の点に注意：

- `store_id`, `staff_id`, `menu_id` がUUID形式か検証していない
- `date`, `time` の形式検証が不十分

**推奨対策**:
```typescript
// UUID検証
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (store_id && !uuidRegex.test(store_id)) {
  throw new Error('Invalid store_id format')
}

// 日付形式検証
const dateRegex = /^\d{4}-\d{2}-\d{2}$/
if (!dateRegex.test(date)) {
  throw new Error('Invalid date format (expected YYYY-MM-DD)')
}

// 時間形式検証
const timeRegex = /^\d{2}:\d{2}$/
if (!timeRegex.test(time)) {
  throw new Error('Invalid time format (expected HH:MM)')
}
```

**問題2: XSS対策**

**評価**: 
- `memo`, `real_name`, `display_name` などのユーザー入力がGoogle Calendarの説明文に直接挿入される
- Google CalendarはHTMLをサニタイズするため、リスクは低いが、念のためエスケープを推奨

```typescript:1114-1124:supabase/functions/booking/index.ts
const description = `
■予約詳細
【お名前】 ${real_name || display_name || 'ゲスト'} 様
【メモ】
${memo || 'なし'}
LINE ID: ${line_user_id}
`.trim()
```

#### サービスロールキーの使用

**現状**: Edge Functionで `SUPABASE_SERVICE_ROLE_KEY` を使用しており、RLSをバイパスしています。

```typescript:155-158:supabase/functions/booking/index.ts
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)
```

**評価**: 
- Edge Function内で適切な権限チェックを行っているため、問題なし
- ただし、コードレビューとテストが重要

#### CORS設定

**現状**: 
```typescript:4-7:supabase/functions/booking/index.ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

**問題**: `Access-Control-Allow-Origin: *` により、任意のオリジンからアクセス可能

**推奨対策**: 
- 本番環境では特定のオリジンのみ許可
- 環境変数でオリジンを設定

```typescript
const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || ['*']
const origin = req.headers.get('origin')
const corsOrigin = allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin)) 
  ? origin || '*' 
  : allowedOrigins[0]

const corsHeaders = {
  'Access-Control-Allow-Origin': corsOrigin,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

#### temporary_holds のRLSポリシー

**現状**: 
```sql:25-28:supabase/migrations/20260101000000_create_temporary_holds.sql
create policy "Users can manage their own holds" on public.temporary_holds
  for all
  using (line_user_id = auth.jwt() ->> 'sub' or store_id in (select id from public.stores where owner_id = auth.uid()))
```

**問題**: 
- `auth.jwt() ->> 'sub'` はSupabase AuthのユーザーIDを参照しているが、LINEユーザーIDとは異なる
- 実際にはサービスロールでアクセスしているため、このポリシーは機能していない可能性

**評価**: 
- Edge Functionでサービスロールを使用しているため、RLSはバイパスされる
- ただし、直接Supabaseクライアントからアクセスする場合のセキュリティホールになる可能性

**推奨対策**: 
- `temporary_holds` への直接アクセスを禁止（RLSで `anon` からのアクセスを拒否）
- Edge Function経由のみアクセス可能にする

---

## 4. 推奨改善事項（優先順位順）

### 🔴 高優先度

1. **レースコンディション対策**
   - データベーストランザクション + 排他ロックの実装
   - または、楽観的ロックの実装

2. **入力検証の強化**
   - UUID形式の検証
   - 日付・時間形式の検証
   - 過去日付・未来日付の制限

3. **認証の統一**
   - `check_customer` と `get_active_reservation` でも `line_user_id` の検証を必須化
   - または、`line_user_id` が `U` で始まる場合のみ許可

### 🟡 中優先度

4. **CORS設定の見直し**
   - 本番環境で特定オリジンのみ許可

5. **エラーハンドリングの改善**
   - 適切なエラーメッセージの返却
   - ログレベルの適切な設定

### 🟢 低優先度

7. **単体テストの追加**
   - 時間帯重複判定の境界条件テスト
   - 認証・認可のテスト

8. **監査ログ**
   - 予約作成・更新・キャンセルのログ記録

---

## 5. 総合評価

### 5.1 ロジック評価: ⭐⭐⭐⭐ (4/5)

**強み**:
- 仮押さえメカニズムによる重複防止
- 営業時間・スタッフ勤務時間の考慮
- Google Calendar連携

**弱み**:
- レースコンディション対策が不十分
- 入力検証が不十分

### 5.2 セキュリティ評価: ⭐⭐⭐⭐ (4/5)

**強み**:
- LINE Access Token検証
- Channel ID検証（クロスチャネル攻撃対策）
- IDOR対策
- RLSポリシー

**弱み**:
- 一部のアクションで認証が不要
- CORS設定が緩い
- 入力検証が不十分

### 5.3 総合スコア: ⭐⭐⭐⭐ (4/5)

**評価**: 
システムは全体的に良好な設計ですが、レースコンディション対策と入力検証の強化が必要です。セキュリティ面では基本的な対策は実装されていますが、細部の改善によりさらに堅牢になります。

---

## 6. 補足情報

### 6.1 テスト推奨項目

1. **レースコンディションテスト**
   - 同時に同じ時間枠を予約する2つのリクエストを送信
   - 重複予約が発生しないことを確認

2. **認証テスト**
   - 無効なトークンでのアクセスを拒否
   - 別チャネルのトークンでのアクセスを拒否
   - 他人の予約のキャンセルを拒否

3. **入力検証テスト**
   - 無効なUUID形式
   - 無効な日付形式
   - 過去の日付
   - 営業時間外の時間

### 6.2 参考資料

- `SECURITY.md`: セキュリティポリシー
- `verify_security.ts`: セキュリティ検証スクリプト
- `REGRESSION_CHECKLIST.md`: リグレッションテスト項目

---

**評価者**: AI Assistant  
**評価日**: 2025年1月
