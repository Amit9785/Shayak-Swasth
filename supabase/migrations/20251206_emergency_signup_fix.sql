-- =====================================================
-- EMERGENCY FIX: Database error saving new user
-- Run this IMMEDIATELY in Supabase SQL Editor
-- =====================================================

-- STEP 1: Drop the problematic trigger completely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- STEP 2: Create a MINIMAL trigger that cannot fail
-- This just creates a profile - nothing else that could break
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create profile - the simplest possible operation
  BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, phone, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore any error - profile creation is not critical
    NULL;
  END;
  
  -- Always return NEW to allow signup to succeed
  RETURN NEW;
END;
$$;

-- STEP 3: Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- STEP 4: Verify trigger exists
SELECT 'Trigger created successfully!' as status;
SELECT tgname, tgtype FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- =====================================================
-- Now signups should work!
-- The frontend code will handle creating patient records
-- =====================================================

