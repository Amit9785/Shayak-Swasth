-- =====================================================
-- FIX: Create patient records on signup
-- This trigger WILL create patient records
-- Run in Supabase SQL Editor
-- =====================================================

-- Step 1: Remove old trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Step 2: Create working trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Get role from signup metadata
  v_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));
  
  -- Always create profile first
  INSERT INTO profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email;

  -- Create user role
  IF v_role IN ('patient', 'doctor', 'hospital_manager', 'admin') THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.id, v_role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Create PATIENT record
  IF v_role = 'patient' THEN
    INSERT INTO patients (
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
      'MED-' || SUBSTRING(NEW.id::TEXT, 1, 8),
      COALESCE((NEW.raw_user_meta_data->>'date_of_birth')::DATE, '1990-01-01'::DATE),
      COALESCE(NEW.raw_user_meta_data->>'gender', 'other'),
      NEW.raw_user_meta_data->>'blood_type',
      NEW.raw_user_meta_data->>'emergency_contact',
      NEW.raw_user_meta_data->>'address'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Create DOCTOR record
  IF v_role = 'doctor' THEN
    INSERT INTO doctors (user_id, license_number, specialization, qualification, approval_status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'license_number', 'LIC-' || SUBSTRING(NEW.id::TEXT, 1, 8)),
      COALESCE(NEW.raw_user_meta_data->>'specialization', 'General'),
      COALESCE(NEW.raw_user_meta_data->>'qualification', 'MBBS'),
      'pending'::approval_status
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Create HOSPITAL MANAGER record  
  IF v_role = 'hospital_manager' THEN
    INSERT INTO hospital_managers (user_id, hospital_name, department, created_by)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'hospital_name', 'Hospital'),
      NEW.raw_user_meta_data->>'department',
      NEW.id
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail signup
  RAISE LOG 'handle_new_user error for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Step 3: Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Create patient records for EXISTING users who don't have them
INSERT INTO patients (user_id, medical_id, date_of_birth, gender)
SELECT 
  au.id,
  'MED-' || SUBSTRING(au.id::TEXT, 1, 8),
  COALESCE((au.raw_user_meta_data->>'date_of_birth')::DATE, '1990-01-01'::DATE),
  COALESCE(au.raw_user_meta_data->>'gender', 'other')
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'patient'
AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.user_id = au.id)
ON CONFLICT (user_id) DO NOTHING;

-- Step 5: Create user_roles for existing users
INSERT INTO user_roles (user_id, role)
SELECT au.id, 'patient'::app_role
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'patient'
AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = au.id AND ur.role = 'patient')
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 6: Verify
SELECT 'Checking results...' as status;
SELECT COUNT(*) as total_auth_users FROM auth.users;
SELECT COUNT(*) as total_patients FROM patients;
SELECT COUNT(*) as total_user_roles FROM user_roles WHERE role = 'patient';

-- Show any patient users missing records
SELECT 'Users with patient role but missing from patients table:' as check;
SELECT au.id, au.email, au.raw_user_meta_data->>'role' as role
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'patient'
AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.user_id = au.id);

SELECT 'Done! Try signup with a NEW email now.' as instruction;

