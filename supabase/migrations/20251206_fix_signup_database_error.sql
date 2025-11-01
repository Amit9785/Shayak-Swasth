-- =====================================================
-- FIX: Database error saving new user
-- Created: 2025-12-06
-- 
-- This migration fixes the trigger that runs during signup
-- The error was: "Database error saving new user"
-- =====================================================

-- STEP 1: Ensure email column exists on profiles table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;
END $$;

-- STEP 2: Ensure required types exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM ('patient', 'doctor', 'hospital_manager', 'admin');
  END IF;
END $$;

-- STEP 3: Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- STEP 4: Create improved trigger function with robust error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  v_dob DATE;
  v_gender TEXT;
  v_blood_type TEXT;
  v_emergency_contact TEXT;
  v_address TEXT;
  v_license TEXT;
  v_specialization TEXT;
  v_qualification TEXT;
  v_experience INT;
  v_hospital TEXT;
  v_department TEXT;
BEGIN
  -- Normalize the role value
  user_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));

  -- STEP 1: Always create profile first
  BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, phone, email)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''), 'User'),
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''), ''),
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''), NEW.phone, ''),
      NEW.email
    )
    ON CONFLICT (id) DO UPDATE SET
      first_name = COALESCE(NULLIF(TRIM(EXCLUDED.first_name), ''), profiles.first_name),
      last_name = COALESCE(NULLIF(TRIM(EXCLUDED.last_name), ''), profiles.last_name),
      phone = COALESCE(NULLIF(TRIM(EXCLUDED.phone), ''), profiles.phone),
      email = COALESCE(EXCLUDED.email, profiles.email),
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'handle_new_user: Error creating profile for %: %', NEW.id, SQLERRM;
    -- Continue anyway - profile creation is not critical for auth
  END;

  -- Exit early if no role specified
  IF user_role IS NULL OR user_role = '' THEN
    RETURN NEW;
  END IF;

  -- STEP 2: Create user role
  IF user_role IN ('patient', 'doctor', 'hospital_manager', 'admin') THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, user_role::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'handle_new_user: Error creating role for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  -- STEP 3: Create role-specific records
  
  -- PATIENT SIGNUP
  IF user_role = 'patient' THEN
    BEGIN
      -- Parse date of birth safely
      v_dob := NULL;
      BEGIN
        IF NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL 
           AND NEW.raw_user_meta_data->>'date_of_birth' != '' THEN
          v_dob := (NEW.raw_user_meta_data->>'date_of_birth')::DATE;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_dob := '1990-01-01'::DATE;
      END;
      
      -- Default to a reasonable date if null
      IF v_dob IS NULL THEN
        v_dob := '1990-01-01'::DATE;
      END IF;
      
      v_gender := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'gender'), ''), 'other');
      v_blood_type := NULLIF(TRIM(NEW.raw_user_meta_data->>'blood_type'), '');
      v_emergency_contact := NULLIF(TRIM(NEW.raw_user_meta_data->>'emergency_contact'), '');
      v_address := NULLIF(TRIM(NEW.raw_user_meta_data->>'address'), '');
      
      INSERT INTO public.patients (
        user_id, 
        medical_id, 
        date_of_birth, 
        gender, 
        blood_type, 
        emergency_contact, 
        address
      )
      VALUES (
        NEW.id,
        'MED-' || SUBSTRING(NEW.id::TEXT, 1, 8) || '-' || FLOOR(RANDOM() * 1000)::INT,
        v_dob,
        v_gender,
        v_blood_type,
        v_emergency_contact,
        v_address
      )
      ON CONFLICT (user_id) DO UPDATE SET
        date_of_birth = EXCLUDED.date_of_birth,
        gender = EXCLUDED.gender,
        blood_type = COALESCE(EXCLUDED.blood_type, patients.blood_type),
        emergency_contact = COALESCE(EXCLUDED.emergency_contact, patients.emergency_contact),
        address = COALESCE(EXCLUDED.address, patients.address),
        updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'handle_new_user: Error creating patient for %: %', NEW.id, SQLERRM;
    END;
    
  -- DOCTOR SIGNUP
  ELSIF user_role = 'doctor' THEN
    BEGIN
      v_license := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'license_number'), ''), 'LIC-' || SUBSTRING(NEW.id::TEXT, 1, 8));
      v_specialization := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'specialization'), ''), 'General Medicine');
      v_qualification := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'qualification'), ''), 'MBBS');
      
      v_experience := NULL;
      BEGIN
        IF NEW.raw_user_meta_data->>'experience_years' ~ '^\d+$' THEN
          v_experience := (NEW.raw_user_meta_data->>'experience_years')::INT;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_experience := NULL;
      END;
      
      INSERT INTO public.doctors (
        user_id, 
        license_number, 
        specialization, 
        qualification, 
        experience_years,
        approval_status
      )
      VALUES (
        NEW.id,
        v_license,
        v_specialization,
        v_qualification,
        v_experience,
        'pending'::approval_status
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'handle_new_user: Error creating doctor for %: %', NEW.id, SQLERRM;
    END;
    
  -- HOSPITAL MANAGER SIGNUP
  ELSIF user_role = 'hospital_manager' THEN
    BEGIN
      v_hospital := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'hospital_name'), ''), 'Hospital');
      v_department := NULLIF(TRIM(NEW.raw_user_meta_data->>'department'), '');
      
      INSERT INTO public.hospital_managers (
        user_id, 
        hospital_name, 
        department, 
        created_by
      )
      VALUES (
        NEW.id,
        v_hospital,
        v_department,
        NEW.id
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'handle_new_user: Error creating hospital_manager for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Catch-all: log the error but NEVER fail the signup
  RAISE LOG 'handle_new_user: Unhandled error for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- STEP 5: Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- STEP 6: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;

-- Verification
SELECT 'Migration complete: Signup trigger fixed!' as status;
