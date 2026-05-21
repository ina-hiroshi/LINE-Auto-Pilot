# リグレッションチェックメモ

## フロントエンド
- 予約導線（/booking, LIFF想定）: ログイン→店舗設定取得→スタッフ/メニュー選択→枠取得→予約確定→完了画面。既存予約がある場合は既存予約表示とキャンセル/変更動作。
- 予約一覧（/reservations）: 予約一覧取得・詳細モーダル表示・キャンセル/変更（時間/スタッフ/メニュー/メモ）・リアルタイム反映（reservations-realtime）。
- Google連携（/reservations）: 連携開始→Google同意→コードコールバック処理→カレンダー保存→イベント取得（月/週/日）。連携解除は未実装ならスキップを明記。
- Google同期（Webhook）: カレンダー設定保存時に同期開始（Watch）が成功するか。Googleカレンダー側で予定を作成・削除し、数秒〜数分後に予約一覧に反映されるか。
- LINE設定プレビュー（/line-settings→Bookingプレビューiframe）: 設定変更がiframeへpostMessageされ表示が更新されること。
- 認証/ルーティング: ログアウトでストレージクリア→トップへ遷移。/booking は未ログインでも動作、他は初期セットアップ未完なら /initial-setup へ。

## Edge Functions
- booking: check_customer / get_active_reservation / get_available_slots / create_reservation / update_reservation / cancel_reservation それぞれ200レスポンスと想定JSON。
- line-webhook: 署名検証OK時に自動応答が返る・customer_logsへ記録。replyToken/テキスト欠落時は安全にスキップ。
- google-auth: GETで認可URL返却、POSTでrefresh_token保存（google_calendar_settings upsert）。
- google-calendar: action=list_calendars, list_events が200返却。
- get-line-bot-info: channel_token必須、200でBot情報取得。

## 環境/ビルド
- `npm run build` が成功（現在Chunk size警告のみ）。
- Supabaseキー・LIFF ID 等の必須環境変数が本番/プレビューで設定済み。
- Edge Functions デプロイ例: `supabase functions deploy line-webhook --no-verify-jwt` など必要分を実行。

## 予約変更（LIFF）Production 反映チェック
- feature ブランチの修正は Vercel **Preview** のみに載ることがある。LIFF Endpoint URL が指す **Production** に main マージ後デプロイされているか確認する。
- 予約変更画面に診断テキスト（`API v... | reservation_id=... | 除外=...`）が表示されること。表示されない場合は古いフロントが LIFF に届いている。
- `get_available_slots`（`reservation_id` あり）の `_debug.modifyExclude.reservationId` が変更対象 UUID と一致すること。
- 14:30 / 180分の予約変更で 12:00・15:00・15:30 が ○、HPB 等の外部 Google 予約時間は × のままであること。
- 変更確定（`hold_slot` → `update_reservation`）が成功すること。
