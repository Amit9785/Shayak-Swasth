-- =====================================================
-- FIX: Allow patients to view doctor profiles
-- Run this in Supabase SQL Editor
-- =====================================================

-- Allow anyone authenticated to view profiles (needed for showing doctor names)
DROP POLICY IF EXISTS "Profiles are viewable" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Create policy to allow viewing profiles
CREATE POLICY "Anyone can view profiles"
ON public.profiles FOR SELECT
USING (true);

-- Verify
SELECT 'Done!' as result;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';

