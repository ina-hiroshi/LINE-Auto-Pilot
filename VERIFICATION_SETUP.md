# 認証コード機能の設定ガイド

## 概要
新規登録時にメールで6桁の認証コードを送信し、入力してもらうことでメールアドレスを検証します。

## 必要なもの
- Resendアカウント（無料プランで月10,000通まで）

## セットアップ手順

### 1. Resendアカウントの作成

1. [Resend](https://resend.com)にアクセス
2. "Start Building" または "Sign Up" をクリック
3. GitHubアカウントでサインアップ

### 2. APIキーの取得

1. Resendダッシュボードにログイン
2. 左メニューから "API Keys" をクリック
3. "Create API Key" をクリック
4. 名前を入力（例：LINE-Auto-Pilot-Production）
5. Permissionは "Sending access" を選択
6. "Create" をクリックしてAPIキーをコピー

### 3. ドメイン設定（推奨）

デフォルトでは `onboarding@resend.dev` から送信されますが、独自ドメインを設定することを推奨します。

1. Resendダッシュボードの "Domains" をクリック
2. "Add Domain" をクリック
3. あなたのドメイン（例：yourdomain.com）を入力
4. 表示されるDNSレコードを、ドメインのDNS設定に追加
   - TXTレコード（検証用）
   - MXレコード（受信用、オプション）
   - DKIMレコード（認証用）

### 4. Supabaseへの設定

#### Edge Functionの環境変数設定

```bash
# Supabase CLIでシークレットを設定
supabase secrets set RESEND_API_KEY="re_xxxxxxxxxx"
```

#### マイグレーションの適用

```bash
# データベースマイグレーションを適用
supabase db push
```

#### Edge Functionのデプロイ

```bash
# 認証コード送信
supabase functions deploy send-verification-code --no-verify-jwt

# 認証コード検証
supabase functions deploy verify-code --no-verify-jwt
```

### 5. メールテンプレートのカスタマイズ（オプション）

`supabase/functions/send-verification-code/index.ts` の `html` 部分を編集して、メールのデザインをカスタマイズできます。

```typescript
html: `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    <!-- ここにカスタムHTMLを記述 -->
  </div>
`
```

## トラブルシューティング

### メールが届かない場合

1. **迷惑メールフォルダを確認**
2. **Resendのログを確認**
   - Resendダッシュボードの "Logs" で送信状況を確認
3. **APIキーの権限を確認**
   - "Sending access" が付与されているか確認

### 認証コードが無効と表示される場合

1. **有効期限を確認**（15分間有効）
2. **データベースを確認**
   ```sql
   SELECT * FROM verification_codes 
   WHERE email = 'user@example.com' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

### Edge Functionのエラー

```bash
# ログを確認
supabase functions logs send-verification-code
supabase functions logs verify-code
```

## 仕様

- **認証コード**: 6桁の数字
- **有効期限**: 15分
- **再送信**: 60秒のクールダウン
- **保存**: Supabaseの `verification_codes` テーブル

## セキュリティ考慮事項

- 認証コードは一度検証されたら `verified = true` に更新され、再利用できない
- 古いコード（24時間以上）は自動的に削除される
- 同じメールアドレスで新しいコードが発行されると、古い未検証コードは削除される
