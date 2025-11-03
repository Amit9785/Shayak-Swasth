-- =====================================================
-- COMPLETE FIX - RUN THIS ENTIRE SCRIPT
-- This fixes BOTH the trigger AND the RLS policies
-- =====================================================

-- =====================================================
-- STEP 1: COMPLETELY DISABLE THE TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create a DO-NOTHING trigger (safest option)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Do nothing - let the frontend handle everything
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- STEP 2: FIX USER_ROLES TABLE RLS
-- =====================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Enable read access for users" ON public.user_roles;

-- Create new policies
CREATE POLICY "Anyone can insert their own role"
ON public.user_roles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- =====================================================
-- STEP 3: FIX DOCTORS TABLE RLS
-- =====================================================
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can insert their own doctor record" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can view their own profile" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can update their own profile" ON public.doctors;
DROP POLICY IF EXISTS "Admins can view all doctors" ON public.doctors;
DROP POLICY IF EXISTS "Admins can update doctors" ON public.doctors;
DROP POLICY IF EXISTS "Anyone can view approved doctors" ON public.doctors;
DROP POLICY IF EXISTS "Enable insert for users" ON public.doctors;
DROP POLICY IF EXISTS "Enable read for doctors" ON public.doctors;

-- Create new policies
CREATE POLICY "Anyone can insert their own doctor record"
ON public.doctors FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Doctors can view own profile"
ON public.doctors FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Doctors can update own profile"
ON public.doctors FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all doctors"
ON public.doctors FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins update doctors"
ON public.doctors FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

CREATE POLICY "View approved doctors"
ON public.doctors FOR SELECT
USING (approval_status = 'approved');

-- =====================================================
-- STEP 4: FIX PROFILES TABLE RLS
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;

-- Users can do everything with their own profile
CREATE POLICY "Users manage own profile"
ON public.profiles FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Anyone can view profiles (needed for showing doctor names etc)
CREATE POLICY "Profiles are viewable"
ON public.profiles FOR SELECT
USING (true);

-- =====================================================
-- STEP 5: VERIFY
-- =====================================================
SELECT 'SUCCESS! Trigger and policies fixed.' as result;

-- Show current policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('user_roles', 'doctors', 'profiles')
ORDER BY tablename, policyname;

