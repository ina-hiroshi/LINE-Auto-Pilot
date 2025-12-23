# LINE Webhook Function

LINE Messaging API からの Webhook イベントを受け取り、処理する Edge Function です。

## 特徴

- **マルチテナント対応**: 1 つの Webhook URL で複数の LINE 公式アカウント（店舗）を識別し、適切なアクセストークンを使用して応答します。
- **Edge Runtime 最適化**: Node.js 依存のライブラリ（`crypto`など）を使用せず、Web 標準 API（Web Crypto API, fetch）のみで実装されているため、Supabase Edge Functions 上で高速・安定して動作します。

## 処理フロー

1.  **リクエスト受信**

    - LINE プラットフォームから `POST` リクエストを受信。
    - ヘッダーの `x-line-signature` とボディ（JSON）を取得。

2.  **アカウント特定 (Multi-tenancy)**

    - リクエストボディ内の `destination` (LINE 公式アカウントの User ID) を抽出。
    - Supabase DB の `line_accounts` テーブルを `line_user_id` で検索。
    - 該当する店舗の `channel_secret` と `channel_access_token` を取得。

3.  **セキュリティ検証 (Signature Verification)**

    - **Web Crypto API** を使用して HMAC-SHA256 署名を生成。
    - LINE から送信された署名と照合し、改ざんされていないことを確認。
    - _Note: `@line/bot-sdk` は内部で Node.js 固有の `crypto` モジュールを使用するため、Edge 環境では使用していません。_

4.  **イベント処理**
    - 署名が正しい場合のみイベントを処理。
    - 現在は `message` イベント（テキスト）に対して、オウム返しを行うロジックを実装。
    - LINE Messaging API へのリクエストには標準の `fetch` を使用。

## デプロイ方法

Docker を使用せず、直接クラウドへデプロイする場合：

```bash
supabase functions deploy line-webhook --use-api --no-verify-jwt
```

- `--use-api`: Docker を使用せず、サーバーサイドでバンドルを行います。
- `--no-verify-jwt`: LINE からのリクエストには Supabase の認証ヘッダーがないため、JWT 検証を無効化します（セキュリティは LINE の署名検証で担保）。

```

```
