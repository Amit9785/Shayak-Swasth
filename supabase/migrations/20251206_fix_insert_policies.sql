-- =====================================================
-- FIX RLS POLICIES TO ALLOW PATIENT SELF-INSERT
-- Run this in Supabase SQL Editor
-- =====================================================

-- Allow authenticated users to insert their own patient record
DROP POLICY IF EXISTS "patients_insert_own" ON public.patients;
DROP POLICY IF EXISTS "Allow authenticated users to insert their own patient record" ON public.patients;

CREATE POLICY "patients_insert_own" 
  ON public.patients 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to insert their own user_role
DROP POLICY IF EXISTS "user_roles_insert_own" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;

CREATE POLICY "user_roles_insert_own" 
  ON public.user_roles 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Verify policies exist
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('patients', 'user_roles')
ORDER BY tablename, policyname;

SELECT 'Policies updated!' as status;
