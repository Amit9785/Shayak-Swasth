-- =====================================================
-- FIX RLS POLICIES FOR SIGNUP
-- Allow new users to insert their own roles and records
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- USER_ROLES TABLE
-- =====================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Users can insert their own role during signup
CREATE POLICY "Users can insert their own role"
ON public.user_roles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);

-- =====================================================
-- DOCTORS TABLE
-- =====================================================
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own doctor record" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can view their own profile" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can update their own profile" ON public.doctors;
DROP POLICY IF EXISTS "Admins can view all doctors" ON public.doctors;
DROP POLICY IF EXISTS "Admins can update doctors" ON public.doctors;
DROP POLICY IF EXISTS "Anyone can view approved doctors" ON public.doctors;

-- Users can insert their own doctor record during signup
CREATE POLICY "Users can insert their own doctor record"
ON public.doctors FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Doctors can view their own profile
CREATE POLICY "Doctors can view their own profile"
ON public.doctors FOR SELECT
USING (auth.uid() = user_id);

-- Doctors can update their own profile
CREATE POLICY "Doctors can update their own profile"
ON public.doctors FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view ALL doctors (including pending)
CREATE POLICY "Admins can view all doctors"
ON public.doctors FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Admins can update doctors (for approval)
CREATE POLICY "Admins can update doctors"
ON public.doctors FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Anyone can view approved doctors (for booking)
CREATE POLICY "Anyone can view approved doctors"
ON public.doctors FOR SELECT
USING (approval_status = 'approved');

-- =====================================================
-- PROFILES TABLE (make sure users can update their own)
-- =====================================================
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- =====================================================
-- VERIFY
-- =====================================================
SELECT 'RLS Policies fixed!' as result;

SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('user_roles', 'doctors', 'profiles')
ORDER BY tablename, policyname;
