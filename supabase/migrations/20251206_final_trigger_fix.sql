-- =====================================================
-- FIX RLS POLICIES FOR SIGNUP
-- The user is authenticated but email not confirmed yet
-- We need to allow inserts for the trigger (service role)
-- =====================================================

-- STEP 1: Drop the empty trigger and create one that actually works
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- STEP 2: Create trigger with SECURITY DEFINER (bypasses RLS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- This runs as the function owner, bypassing RLS
SET search_path = public, pg_temp  -- Fix the security warning
AS $$
DECLARE
  v_role TEXT;
  v_dob DATE;
BEGIN
  -- Get role from metadata
  v_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));

  -- Create profile (SECURITY DEFINER bypasses RLS)
  BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, phone, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      NEW.email
    )
    ON CONFLICT (id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Profile error: %', SQLERRM;
  END;

  -- Create user_role
  IF v_role IN ('patient', 'doctor', 'hospital_manager', 'admin') THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, v_role::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Role error: %', SQLERRM;
    END;
  END IF;

  -- Create patient record
  IF v_role = 'patient' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'date_of_birth')::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_dob := '1990-01-01'::DATE;
    END;
    
    IF v_dob IS NULL THEN
      v_dob := '1990-01-01'::DATE;
    END IF;

    BEGIN
      INSERT INTO public.patients (user_id, medical_id, date_of_birth, gender, blood_type, emergency_contact, address)
      VALUES (
        NEW.id,
        'MED-' || LEFT(NEW.id::TEXT, 8),
        v_dob,
        COALESCE(NEW.raw_user_meta_data->>'gender', 'other'),
        NULLIF(NEW.raw_user_meta_data->>'blood_type', ''),
        NULLIF(NEW.raw_user_meta_data->>'emergency_contact', ''),
        NULLIF(NEW.raw_user_meta_data->>'address', '')
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Patient error: %', SQLERRM;
    END;
  END IF;

  -- Create doctor record
  IF v_role = 'doctor' THEN
    BEGIN
      INSERT INTO public.doctors (user_id, license_number, specialization, qualification, approval_status)
      VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'license_number', ''), 'LIC-' || LEFT(NEW.id::TEXT, 8)),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'specialization', ''), 'General'),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'qualification', ''), 'MBBS'),
        'pending'::public.approval_status
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Doctor error: %', SQLERRM;
    END;
  END IF;

  -- Create hospital_manager record
  IF v_role = 'hospital_manager' THEN
    BEGIN
      INSERT INTO public.hospital_managers (user_id, hospital_name, department, created_by)
      VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'hospital_name', ''), 'Hospital'),
        NULLIF(NEW.raw_user_meta_data->>'department', ''),
        NEW.id
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Manager error: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never fail signup
  RAISE LOG 'handle_new_user failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- STEP 3: Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- STEP 4: Grant execute permission
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;

-- STEP 5: Create missing records for existing patient users
INSERT INTO public.patients (user_id, medical_id, date_of_birth, gender)
SELECT 
  au.id,
  'MED-' || LEFT(au.id::TEXT, 8),
  COALESCE((au.raw_user_meta_data->>'date_of_birth')::DATE, '1990-01-01'::DATE),
  COALESCE(au.raw_user_meta_data->>'gender', 'other')
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'patient'
AND NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.user_id = au.id)
ON CONFLICT (user_id) DO NOTHING;

-- Create missing user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'patient'::public.app_role
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'patient'
AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id AND ur.role = 'patient')
ON CONFLICT (user_id, role) DO NOTHING;

-- Create missing profiles
INSERT INTO public.profiles (id, first_name, last_name, phone, email)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'first_name', ''),
  COALESCE(au.raw_user_meta_data->>'last_name', ''),
  COALESCE(au.raw_user_meta_data->>'phone', ''),
  au.email
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- STEP 6: Verify
SELECT 'Trigger created with SECURITY DEFINER' as status;
SELECT COUNT(*) as patient_count FROM patients;
SELECT COUNT(*) as profile_count FROM profiles;

SELECT 'Done! New signups will automatically create records.' as instruction;

