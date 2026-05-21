-- PostgREST のスキーマキャッシュを更新（customer_treatment_notes 等の新テーブル反映）
NOTIFY pgrst, 'reload schema';
