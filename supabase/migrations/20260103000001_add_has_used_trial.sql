-- profilesテーブルにhas_used_trialカラムを追加
-- トライアル期間の再利用を防止するためのフラグ

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;

-- 既存のProプランユーザーは過去にトライアルを使用したとみなす
UPDATE profiles 
SET has_used_trial = TRUE 
WHERE plan = 'pro';

COMMENT ON COLUMN profiles.has_used_trial IS 'ユーザーが過去にトライアル期間を利用したかどうか。trueの場合、再度トライアルは適用されない。';
