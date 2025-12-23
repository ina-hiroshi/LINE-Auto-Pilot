-- 1. profiles テーブル（ユーザー管理）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. line_accounts テーブル（LINE連携設定）
CREATE TABLE IF NOT EXISTS line_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  channel_id TEXT,
  channel_secret TEXT,
  channel_access_token TEXT,
  bot_id TEXT UNIQUE NOT NULL, -- WebhookのURL識別用
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. auto_responses テーブル（自動応答設定）
CREATE TABLE IF NOT EXISTS auto_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_account_id UUID REFERENCES line_accounts(id) ON DELETE CASCADE NOT NULL,
  keyword TEXT NOT NULL,
  response_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_ai_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. reservations テーブル（予約台帳）
CREATE TABLE IF NOT EXISTS reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_account_id UUID REFERENCES line_accounts(id) ON DELETE CASCADE NOT NULL,
  line_user_id TEXT NOT NULL,
  reservation_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. points テーブル（ポイント管理）
CREATE TABLE IF NOT EXISTS points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_account_id UUID REFERENCES line_accounts(id) ON DELETE CASCADE NOT NULL,
  line_user_id TEXT NOT NULL,
  current_points INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(line_account_id, line_user_id)
);

-- 6. Row Level Security (RLS) の有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE points ENABLE ROW LEVEL SECURITY;

-- 7. セキュリティポリシー（自分のデータだけを読み書き可能にする）
-- profiles
DO $$ BEGIN
  CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- line_accounts (profiles経由で自分のものか確認)
DO $$ BEGIN
  CREATE POLICY "Users can manage their own line accounts" ON line_accounts 
    USING (user_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- auto_responses / reservations / points (line_accounts経由で自分のものか確認)
DO $$ BEGIN
  CREATE POLICY "Users can manage their own auto responses" ON auto_responses 
    USING (line_account_id IN (SELECT id FROM line_accounts WHERE user_id = auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage their own reservations" ON reservations 
    USING (line_account_id IN (SELECT id FROM line_accounts WHERE user_id = auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage their own points" ON points 
    USING (line_account_id IN (SELECT id FROM line_accounts WHERE user_id = auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 8. 新規ユーザー登録時に自動でprofilesを作成するトリガー
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

