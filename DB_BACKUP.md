# DBバックアップと復元

Supabaseの無料プランには自動バックアップがないため、GitHub Actions（`.github/workflows/db-backup.yml`）で毎日 3:00 JST にDBを書き出し、暗号化して成果物として30日間保管している。

## 中身

暗号化ファイル `db-backup-YYYYMMDD-HHMM.tar.gz.enc` を復号・展開すると、次の3つが出てくる。

| ファイル | 内容 |
| :--- | :--- |
| `roles.sql` | DBロール |
| `schema.sql` | テーブル・関数・RLSポリシーなどの定義 |
| `data.sql` | データ（`auth.users` を含む）。cron / pg_net の実行ログ（`cron.job_run_details`、`net._http_response`）は除外 |

含まれないもの：

- **Storage のファイル**（リッチメニュー画像など）。DBには置き場所の記録だけが入る
- **Vault のシークレット**、Edge Functions のシークレット
- Edge Functions のコード（リポジトリにある）

## 初回セットアップ

1. 暗号化用のパスフレーズを用意し、**パスワードマネージャーに保存する**。GitHubのSecretは後から読み出せないため、ここで控えを失うと、すべてのバックアップが復号できなくなる。
2. GitHub のリポジトリ → Settings → Secrets and variables → Actions に、次の2つを登録する。
   - `BACKUP_PASSPHRASE`：1 のパスフレーズ
   - `SUPABASE_DB_URL`：Supabase Dashboard → Connect → **Session pooler** の接続文字列（`[YOUR-PASSWORD]` を実際のDBパスワードに置き換える）。Direct connection は IPv6 専用で、GitHub Actions からは接続できない。パスワードに `@` `#` `/` などが含まれる場合はパーセントエンコードする。
3. Actions タブ → 「DB backup」→ Run workflow で手動実行し、成功することを確認する。

## バックアップの取り出しと復号

```sh
# 最新の成果物をダウンロード
gh run list --workflow db-backup.yml --limit 5
gh run download <run-id>

# 復号して展開（パスフレーズを聞かれる）
openssl enc -d -aes-256-cbc -md sha256 -pbkdf2 -iter 600000 \
  -in db-backup-YYYYMMDD-HHMM.tar.gz.enc | tar -xzf - -C restore/
```

`restore/` には顧客の個人情報が入る。作業が終わったら削除し、リポジトリにコミットしない。

## 復元

新しい Supabase プロジェクトを作り、その接続文字列に対して実行する（Supabase公式の手順と同じ）。

```sh
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file restore/roles.sql \
  --file restore/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file restore/data.sql \
  --dbname "<新しいプロジェクトの接続文字列>"
```

そのあと、Edge Functions の再デプロイ、Secrets の再設定、Storage のファイルの再アップロード、LINE の Webhook URL の差し替えが必要になる。

## 注意

- 公開リポジトリでは、リポジトリに60日間コミットなどの動きがないと、定期実行のワークフローが自動で止まる。止まったら GitHub から通知メールが届くので、Actions タブから再度有効にする。
- 実行に失敗したときは、GitHub から通知メールが届く。
