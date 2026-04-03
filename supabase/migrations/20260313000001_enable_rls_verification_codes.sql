-- RLSを有効化してSupabaseのセキュリティ警告を解消
-- verification_codesはEdge Functions（service_role）からのみアクセスされるため、
-- クライアント（anon/authenticated）用のポリシーは不要。
-- service_roleはRLSをバイパスするため、既存のsend-verification-code/verify-codeは影響を受けない。

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- ポリシーなし = anon/authenticated は一切アクセス不可（デフォルトで拒否）
-- これにより認証コードの漏洩を防止しつつ、バックエンドは従来どおり動作
