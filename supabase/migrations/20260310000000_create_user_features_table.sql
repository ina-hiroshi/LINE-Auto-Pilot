-- DB-driven feature flags per user
CREATE TABLE IF NOT EXISTS public.user_features (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_flag text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, feature_flag)
);

ALTER TABLE public.user_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own features"
  ON public.user_features
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all features"
  ON public.user_features
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

COMMENT ON TABLE public.user_features IS 'Per-user feature flags managed by admins';
COMMENT ON COLUMN public.user_features.feature_flag IS 'Feature identifier (e.g. admin_panel, custom_dashboard)';
