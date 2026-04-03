# Stripe設定手順

## 1. Stripeアカウント作成

1. [Stripe](https://stripe.com/jp)にアクセス
2. アカウントを作成（テストモードで開始可能）

## 2. 商品・料金の作成

### Proプラン（月額¥4,980、初月無料）

1. Stripeダッシュボード → **商品カタログ** → **商品を追加**
2. 商品情報を入力：
   - 商品名: `IToguchi Pro プラン`
   - 説明: `全機能解放、AI応答、Googleカレンダー連携など`
3. 料金モデル:
   - **継続支払い**: 月単位
   - 料金: `¥4,980`
   - 通貨: `JPY`
4. **無料トライアル**: 30日間（初月無料）
5. **保存** → **Price ID**をコピー（例: `price_xxxxxxxxxx`）

## 3. 環境変数の設定

### フロントエンド（`.env`）

```bash
VITE_STRIPE_PRO_PRICE_ID=price_xxxxxxxxxx
VITE_STRIPE_SETUP_SERVICE_PRICE_ID=price_xxxxxxxxxx
```

**注意**: 環境変数の設定は必須です。未設定の場合、アプリケーションは起動時にエラーを表示します。

### Supabase Edge Functions（Secrets）

```bash
supabase secrets set STRIPE_SECRET_KEY="sk_test_xxxxxxxxxx"
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxx"
supabase secrets set STRIPE_PRICE_ID_SETUP_SERVICE="price_xxxxxxxxxx"
```

**注意**: 
- `STRIPE_SECRET_KEY`: Stripe APIキー（必須）
- `STRIPE_WEBHOOK_SECRET`: Webhook署名検証用（必須）
- `STRIPE_PRICE_ID_SETUP_SERVICE`: 初期設定代行サービスの価格ID（必須）
- Proプランの価格IDはフロントエンドからリクエストボディで送信されるため、Supabase Edge Functions側での環境変数設定は不要です

## 4. APIキーの取得

1. Stripeダッシュボード → **開発者** → **APIキー**
2. **公開可能キー**: フロントエンドで使用（不要）
3. **シークレットキー**: `sk_test_xxxxx` または `sk_live_xxxxx` をコピー

## 5. Webhookの設定

1. Stripeダッシュボード → **開発者** → **Webhook**
2. **エンドポイントを追加**:
   - URL: `https://puzmemsawziykgzmbvyh.supabase.co/functions/v1/stripe-webhook`
   - リッスンするイベント:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
3. **Webhook署名シークレット**をコピー（`whsec_xxxxx`）

## 6. テスト

### テストカード番号
- 成功: `4242 4242 4242 4242`
- 有効期限: 任意の未来の日付
- CVC: 任意の3桁
- 郵便番号: 任意

### フロー確認
1. オンボーディングでProプランを選択
2. Stripe Checkoutへリダイレクト
3. テストカード情報を入力
4. 決済完了 → オンボーディングに戻る
5. LINE設定ステップへ進む

## 7. 本番環境への移行

1. Stripeダッシュボード → **テストモードを無効化**
2. 本番APIキー（`sk_live_xxxxx`）を取得
3. Webhook URLを本番環境に変更
4. 環境変数を本番キーに更新

## 注意事項

- **テストモード**: 実際の決済は発生しません
- **本番モード**: 実際に課金されます
- **トライアル期間**: 初月無料はアプリ側で `create-checkout-session` が `trial_period_days`（正式リリース時は 30 日）を付与します。コードを変更した場合は **`supabase functions deploy create-checkout-session`** で本番に反映してください（Stripe ダッシュボードの商品に設定したトライアル日数とは別に、Checkout 作成時に上書きされます）。
- **Webhook署名検証**: セキュリティのため必須
