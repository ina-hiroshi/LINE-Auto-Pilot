# セキュリティ設定とポリシー (Security Policy)

このドキュメントでは、LINE Auto-Pilot (IToguchi) のセキュリティ設計、特に認証・認可およびデータ保護に関する実装詳細を記述します。

## 1. Edge Functions の認証・認可

すべての Edge Functions は、原則として認証済みリクエストのみを受け付けるか、厳格なトークン検証を行います。

### 1.1 LINE アクセストークンの検証
`supabase/functions/_shared/line-auth.ts` に定義された `verifyLineToken` ヘルパーを使用し、以下の検証を行います。

1.  **トークンの有効性**: LINE API (`/oauth2/v2.1/verify`) に問い合わせ、トークンが有効であることを確認。
2.  **Channel ID (Client ID) の検証**: トークンの発行元 (`client_id`) が、対象店舗の `line_accounts` テーブルに保存された `channel_id` と一致することを確認。これにより、**クロスチャネル攻撃**（攻撃者が別のチャネルで取得したトークンを悪用する攻撃）を防ぎます。
3.  **ユーザーIDの確定**: リクエストボディに含まれる `line_user_id` を盲信せず、アクセストークンから取得した信頼できる `userId` を使用します。これにより、**なりすまし**を防ぎます。

### 1.2 適用範囲
- **`get-liff-customer`**: LIFF アプリからの顧客情報取得時に適用。
- **`booking`**: 予約作成、確認、キャンセル等の操作時に適用。特に `create_reservation` や `check_customer` では、検証済みユーザーIDの使用を強制します。

## 2. データベースの Row Level Security (RLS)

Supabase の RLS 機能を使用し、データアクセスを厳格に制御しています。

### 2.1 オーナー専用データ (Private)
以下のテーブルは、`stores.owner_id` がログイン中のユーザー (`auth.uid()`) と一致する場合のみ、読み書きが許可されます。

- **`customers`**: 顧客の個人情報（氏名、LINE ID、写真など）。
- **`reservations`**: 予約の詳細情報。
- **`customer_logs`**: メッセージの送受信ログ。
- **`line_accounts`**: Channel Secret や Access Token などの機密情報。

**ポリシー例 (`customers` テーブル):**
```sql
CREATE POLICY "Users can view their own store's customers"
ON public.customers FOR SELECT
USING (
    store_id IN (
        SELECT id FROM public.stores
        WHERE owner_id = auth.uid()
    )
);
```

### 2.2 公開データ (Public)
以下のテーブルは、予約ページ（LIFF/Web）での表示に必要なため、未認証ユーザー (`anon`) からの読み取り (`SELECT`) が許可されています。書き込みはオーナーのみ可能です。

- **`stores`**: 店舗の基本情報（店名、住所、営業時間など）。
- **`staff_members`**: スタッフ情報（名前、役職、画像）。ただし `is_active = true` のレコードのみ。
- **`booking_menus`**: メニュー情報（名前、価格、説明）。ただし `is_active = true` のレコードのみ。

## 3. IDOR (Insecure Direct Object Reference) 対策

予約のキャンセルや更新など、特定のリソース ID (`reservation_id`) を指定する操作において、そのリソースが操作実行者のものであるかを必ず確認しています。

**実装例 (`booking` function):**
```typescript
const { data: reservation } = await supabase.from('reservations').select('line_user_id').eq('id', reservation_id).single();

if (reservation.line_user_id !== verifiedUserId) {
  throw new Error('Unauthorized: You can only cancel your own reservations');
}
```

## 4. 今後の運用上の注意

- **Channel ID の管理**: `line_accounts` テーブルの `channel_id` カラムはセキュリティの要です。管理画面から正しく保存されていることを定期的に確認してください。
- **RLS の維持**: 新しいテーブルを作成する際は、必ず `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` を実行し、適切なポリシーを設定してください。
