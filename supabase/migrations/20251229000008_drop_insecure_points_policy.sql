-- Drop the insecure policy created by 20251229000004_enable_realtime_points.sql
DROP POLICY IF EXISTS "Public read access to points" ON public.points;
