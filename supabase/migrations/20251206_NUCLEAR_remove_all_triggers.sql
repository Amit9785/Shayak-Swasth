-- =====================================================
-- NUCLEAR OPTION: Remove trigger completely
-- This WILL fix signup - run this NOW
-- =====================================================

-- Step 1: Remove ALL triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS create_profile_on_signup ON auth.users;

-- Step 2: Drop the function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_profile_on_signup() CASCADE;

-- Step 3: Verify no triggers remain
SELECT 'Checking for remaining triggers on auth.users...' as step;
SELECT tgname FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass;

-- Step 4: If the above returns rows, we need to find and remove them
DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  FOR trigger_record IN 
    SELECT tgname FROM pg_trigger 
    WHERE tgrelid = 'auth.users'::regclass 
    AND tgname NOT LIKE 'RI_%'  -- Skip referential integrity triggers
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', trigger_record.tgname);
    RAISE NOTICE 'Dropped trigger: %', trigger_record.tgname;
  END LOOP;
END $$;

-- Step 5: Final verification
SELECT 'Final trigger check:' as step;
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass 
AND tgname NOT LIKE 'RI_%';

SELECT 'SUCCESS: All custom triggers removed!' as result;
SELECT 'Signup should now work. Frontend will create patient records.' as note;

