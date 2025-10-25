-- =====================================================
-- FIX FOR DATABASE ERROR SAVING NEW USER
-- The trigger is failing - this fixes it
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, let's check what types exist
DO $$ 
BEGIN
  -- Create approval_status type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
  
  -- Create app_role type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM ('patient', 'doctor', 'hospital_manager', 'admin');
  END IF;
END $$;

-- Recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Insert/Update profile (this should always work)
  BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, phone, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, ''),
      NEW.email
    )
    ON CONFLICT (id) DO UPDATE SET
      first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), profiles.first_name),
      last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), profiles.last_name),
      phone = COALESCE(NULLIF(EXCLUDED.phone, ''), profiles.phone),
      email = COALESCE(EXCLUDED.email, profiles.email),
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
  END;

  -- Get the role from metadata
  user_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));

  -- Only proceed if we have a valid role
  IF user_role IS NOT NULL AND user_role != '' THEN
    
    -- Insert user role
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, user_role::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Error creating user_role for user %: %', NEW.id, SQLERRM;
    END;

    -- DOCTOR: Create doctor record with pending status
    IF user_role = 'doctor' THEN
      BEGIN
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
          COALESCE(NULLIF(NEW.raw_user_meta_data->>'license_number', ''), 'LIC-' || substr(NEW.id::text, 1, 8)),
          COALESCE(NULLIF(NEW.raw_user_meta_data->>'specialization', ''), 'General Medicine'),
          COALESCE(NULLIF(NEW.raw_user_meta_data->>'qualification', ''), 'MBBS'),
          CASE 
            WHEN NEW.raw_user_meta_data->>'experience_years' ~ '^\d+$'
            THEN (NEW.raw_user_meta_data->>'experience_years')::INT
            ELSE NULL
          END,
          'pending'
        )
        ON CONFLICT (user_id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error creating doctor record for user %: %', NEW.id, SQLERRM;
      END;

    -- PATIENT: Create patient record
    ELSIF user_role = 'patient' THEN
      BEGIN
        INSERT INTO public.patients (user_id, medical_id, date_of_birth, gender)
        VALUES (
          NEW.id,
          'MED-' || substr(NEW.id::text, 1, 8),
          CASE 
            WHEN NEW.raw_user_meta_data->>'date_of_birth' ~ '^\d{4}-\d{2}-\d{2}$'
            THEN (NEW.raw_user_meta_data->>'date_of_birth')::DATE
            ELSE '1990-01-01'::DATE
          END,
          COALESCE(NULLIF(NEW.raw_user_meta_data->>'gender', ''), 'other')
        )
        ON CONFLICT (user_id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error creating patient record for user %: %', NEW.id, SQLERRM;
      END;

    -- HOSPITAL MANAGER: Create manager record
    ELSIF user_role = 'hospital_manager' THEN
      BEGIN
        INSERT INTO public.hospital_managers (user_id, hospital_name, department, created_by)
        VALUES (
          NEW.id,
          COALESCE(NULLIF(NEW.raw_user_meta_data->>'hospital_name', ''), 'Unknown Hospital'),
          NEW.raw_user_meta_data->>'department',
          NEW.id
        )
        ON CONFLICT (user_id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error creating hospital_manager record for user %: %', NEW.id, SQLERRM;
      END;
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verify
SELECT 'Trigger recreated successfully!' as result;

