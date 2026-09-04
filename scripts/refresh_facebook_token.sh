#!/usr/bin/env bash
# Facebook Page Access Token を差し替えて、止まっている投稿を即時再実行する。
#
# 使い方:
#   ./scripts/refresh_facebook_token.sh '<長期ユーザーアクセストークン>'
#
# 引数には、アクセストークンデバッガーで「アクセストークンを延長」した後の
# ユーザートークンを渡す。短命トークンを渡すと、そこから作られる Page Token も
# 同じタイミングで失効して同じ障害が再発するため、有効期限を検査して弾く。
set -euo pipefail
cd "$(dirname "$0")/.."

USER_TOKEN="${1:-}"
if [ -z "$USER_TOKEN" ]; then
  echo "エラー: ユーザーアクセストークンを引数で渡してください" >&2
  exit 1
fi

PAGE_ID=1244588425411711
GRAPH=https://graph.facebook.com/v21.0

echo "1/4 ユーザートークンの有効期限を確認..."
# 自分自身を input_token / access_token の両方に使うと、app secret なしで
# expires_at を読める。長期トークンなら 0（無期限扱い）か約60日後になる。
DEBUG_JSON=$(curl -sS -G "$GRAPH/debug_token" \
  --data-urlencode "input_token=$USER_TOKEN" \
  --data-urlencode "access_token=$USER_TOKEN")
EXPIRES_AT=$(printf '%s' "$DEBUG_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("data",{}).get("expires_at","?"))')

if [ "$EXPIRES_AT" = "?" ]; then
  echo "トークンを検証できませんでした:" >&2
  printf '%s\n' "$DEBUG_JSON" | head -c 500 >&2
  exit 1
fi

NOW=$(date +%s)
if [ "$EXPIRES_AT" != "0" ] && [ "$((EXPIRES_AT - NOW))" -lt 604800 ]; then
  echo "エラー: このユーザートークンは7日以内に失効します（expires_at=$EXPIRES_AT）。" >&2
  echo "  デバッガーの「アクセストークンを延長」を実行してから、延長後のトークンを渡してください。" >&2
  echo "  短命トークンのままだと、今回と同じ失効エラーが数時間後に再発します。" >&2
  exit 1
fi
echo "    OK (expires_at=$EXPIRES_AT / 0 は無期限)"

echo "2/4 Page Access Token を取得..."
PAGE_JSON=$(curl -sS -G "$GRAPH/$PAGE_ID" \
  --data-urlencode "fields=name,access_token" \
  --data-urlencode "access_token=$USER_TOKEN")
PAGE_TOKEN=$(printf '%s' "$PAGE_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))')
PAGE_NAME=$(printf '%s' "$PAGE_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("name",""))')

if [ -z "$PAGE_TOKEN" ]; then
  echo "Page Access Token を取得できませんでした:" >&2
  printf '%s\n' "$PAGE_JSON" | head -c 500 >&2
  exit 1
fi
echo "    OK (ページ: $PAGE_NAME)"

echo "3/4 取得した Page Token で投稿権限を確認..."
PERM_JSON=$(curl -sS -G "$GRAPH/$PAGE_ID" \
  --data-urlencode "fields=id" \
  --data-urlencode "access_token=$PAGE_TOKEN")
if ! printf '%s' "$PERM_JSON" | grep -q '"id"'; then
  echo "Page Token が有効ではありません:" >&2
  printf '%s\n' "$PERM_JSON" | head -c 500 >&2
  exit 1
fi
echo "    OK"

echo "4/4 Supabase の FACEBOOK_ACCESS_TOKEN を更新..."
# --env-file 経由で渡し、トークンをコマンドライン（ps やシェル履歴に残る）に置かない。
TMP_ENV=$(mktemp)
trap 'rm -f "$TMP_ENV"' EXIT
chmod 600 "$TMP_ENV"
printf 'FACEBOOK_ACCESS_TOKEN=%s\n' "$PAGE_TOKEN" > "$TMP_ENV"
if ! supabase secrets set --env-file "$TMP_ENV"; then
  # 古い CLI には --env-file が無い。その場合のみ引数渡しにフォールバックする。
  supabase secrets set "FACEBOOK_ACCESS_TOKEN=$PAGE_TOKEN"
fi
echo "    OK"

echo
echo "トークンの差し替えは完了しました。"
echo
echo "止まっている投稿を 21:00 を待たずに流す場合は、Supabase の SQL エディタで"
echo "以下を実行してください。cron 本体と同じ経路です。"
echo "（x-cron-secret は SOCIAL_CRON_SECRET で、vault にしか無いため"
echo "  シェルからは取得できません。リポジトリ直下の .cron-secret.local は"
echo "  別物の CRON_SECRET なので、これで叩くと 401 になります。）"
cat <<'SQL'

select net.http_post(
  url := 'https://puzmemsawziykgzmbvyh.supabase.co/functions/v1/social-post-publish',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
  ),
  body := '{}'::jsonb
);

SQL
