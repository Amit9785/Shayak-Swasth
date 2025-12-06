-- =====================================================
-- EMERGENCY FIX: DISABLE TRIGGER TEMPORARILY
-- This will let signups work, then we fix the trigger
-- =====================================================

-- STEP 1: First, let's see what's wrong
-- Check if the types exist
SELECT typname FROM pg_type WHERE typname IN ('app_role', 'approval_status');

-- Check the doctors table structure
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'doctors';

-- STEP 2: Drop the problematic trigger temporarily
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- STEP 3: Create a SIMPLE trigger that won't fail
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Just create the profile - nothing else
  -- The frontend will handle the rest
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log but don't fail
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- STEP 4: Recreate trigger with simple function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

SELECT 'Simple trigger created - signups should work now!' as result;
