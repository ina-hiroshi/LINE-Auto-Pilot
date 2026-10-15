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

## 5. AIプレビューと配信文生成の利用制限

`ai-chat-preview` と `generate-campaign-message` は、店舗へのアクセス権と店舗オーナーの有料プランをサーバー側で確認します。各機能は店舗ごとに直近1時間30回までで、生成に失敗した試行も回数に含めます。

生成前にサービスロール専用の `reserve_ai_generation` RPC で枠を確保します。同じ店舗・機能の確認と記録をトランザクション内のロックで直列化し、回数を確認・記録できないときは外部AIを呼びません。適用時は `20261015000006_atomic_ai_generation.sql` を先に実行し、その後に両Edge Functionを更新します。

プレビューのメッセージと役割指示は各4,000文字、配信対象の詳細は1,000文字までです。プレビューの口調は `friendly` と `polite` に限定し、それ以外の設定値をプロンプトに渡しません。

## AIへの外部入力と出力の検証（2026-10-15）

- DMの会話履歴は直近10件、本文は各2,000文字、表示名は100文字までとし、JSONでエスケープします。店舗資料は20,000文字までです。Geminiの `systemInstruction` で、これらを指示ではなく参照データとして扱うよう指定します。
- AI自動返信は200文字以内に限定します。超過時は送らず、人の対応に回します。下書きは200文字に切り詰め、送信前に人が確認します。
- 金額・予約・返金・約束・個別相談や、内部指示の開示要求はコード側のルールで人に回します。`needsHuman` の欠落や型の不一致も送信を許可しません。
- 自動返信のURLは店舗資料内のURLとの完全一致、本文の数字は資料内の数値との一致を求めます。ペルソナの20文字以上、店舗資料の60文字以上の連続した逐語出力も送信を止めます。これらは保守的なルールであり、言い換えを含むすべての注入や誤回答を検出するものではありません。
- ダッシュボード分析もメッセージサンプルを各2,000文字のJSONデータにし、指示は `systemInstruction` に分離します。返却する文字列・配列・分類件数を検証し、ランキング4項目は必ずサーバー集計値を使います。AIが生成する分析文の事実性は、型の検証だけでは保証できません。
- 反映対象は `social-dm-poll`、`social-draft-reply`、`dashboard-ai-analysis` です。DBマイグレーションは不要です。
