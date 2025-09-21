-- =====================================================
-- FINAL FIX: PROPER TRIGGER WITH SECURITY DEFINER
-- This creates records for doctors/patients/managers
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create the trigger function with SECURITY DEFINER
-- This bypasses RLS and runs with elevated privileges
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  v_license TEXT;
  v_specialization TEXT;
  v_qualification TEXT;
  v_experience INT;
  v_hospital TEXT;
  v_department TEXT;
  v_dob DATE;
  v_gender TEXT;
BEGIN
  -- Get role from metadata
  user_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));
  
  -- Always create profile
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, ''),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email;

  -- Create user_role if specified
  IF user_role IN ('patient', 'doctor', 'hospital_manager', 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Create role-specific record
  IF user_role = 'doctor' THEN
    v_license := COALESCE(NULLIF(NEW.raw_user_meta_data->>'license_number', ''), 'LIC-' || LEFT(NEW.id::text, 8));
    v_specialization := COALESCE(NULLIF(NEW.raw_user_meta_data->>'specialization', ''), 'General');
    v_qualification := COALESCE(NULLIF(NEW.raw_user_meta_data->>'qualification', ''), 'MBBS');
    
    BEGIN
      v_experience := (NEW.raw_user_meta_data->>'experience_years')::INT;
    EXCEPTION WHEN OTHERS THEN
      v_experience := NULL;
    END;
    
    INSERT INTO public.doctors (user_id, license_number, specialization, qualification, experience_years, approval_status)
    VALUES (NEW.id, v_license, v_specialization, v_qualification, v_experience, 'pending')
    ON CONFLICT (user_id) DO NOTHING;
    
  ELSIF user_role = 'patient' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'date_of_birth')::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_dob := '1990-01-01'::DATE;
    END;
    v_gender := COALESCE(NULLIF(NEW.raw_user_meta_data->>'gender', ''), 'other');
    
    INSERT INTO public.patients (user_id, medical_id, date_of_birth, gender)
    VALUES (NEW.id, 'MED-' || LEFT(NEW.id::text, 8), v_dob, v_gender)
    ON CONFLICT (user_id) DO NOTHING;
    
  ELSIF user_role = 'hospital_manager' THEN
    v_hospital := COALESCE(NULLIF(NEW.raw_user_meta_data->>'hospital_name', ''), 'Hospital');
    v_department := NEW.raw_user_meta_data->>'department';
    
    INSERT INTO public.hospital_managers (user_id, hospital_name, department, created_by)
    VALUES (NEW.id, v_hospital, v_department, NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the signup
  RAISE LOG 'handle_new_user error for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ALSO: Create records for existing users who are missing them
-- =====================================================

-- Find users with doctor role but no doctor record
INSERT INTO public.doctors (user_id, license_number, specialization, qualification, approval_status)
SELECT 
  ur.user_id,
  'LIC-' || LEFT(ur.user_id::text, 8),
  'General Medicine',
  'MBBS',
  'pending'
FROM user_roles ur
WHERE ur.role = 'doctor'
AND NOT EXISTS (SELECT 1 FROM doctors d WHERE d.user_id = ur.user_id)
ON CONFLICT (user_id) DO NOTHING;

-- Find users with hospital_manager role but no manager record
INSERT INTO public.hospital_managers (user_id, hospital_name, department, created_by)
SELECT 
  ur.user_id,
  'Hospital',
  'General',
  ur.user_id
FROM user_roles ur
WHERE ur.role = 'hospital_manager'
AND NOT EXISTS (SELECT 1 FROM hospital_managers hm WHERE hm.user_id = ur.user_id)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- VERIFY
-- =====================================================
SELECT 'Trigger created!' as step1;
SELECT COUNT(*) as doctors_count FROM doctors;
SELECT COUNT(*) as managers_count FROM hospital_managers;
SELECT * FROM doctors;

