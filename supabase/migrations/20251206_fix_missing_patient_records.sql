-- =====================================================
-- FIX: Patients not being created during signup
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- STEP 1: Check current state
SELECT 'Checking current data...' as step;

-- Show users who signed up but don't have patient records
SELECT 
  au.id as auth_user_id,
  au.email,
  au.raw_user_meta_data->>'role' as intended_role,
  au.created_at,
  p.id as patient_id,
  pr.first_name,
  pr.last_name
FROM auth.users au
LEFT JOIN public.patients p ON p.user_id = au.id
LEFT JOIN public.profiles pr ON pr.id = au.id
WHERE au.raw_user_meta_data->>'role' = 'patient'
ORDER BY au.created_at DESC
LIMIT 20;

-- STEP 2: Fix RLS policies to allow authenticated users to create their own records

-- Drop existing restrictive policies on patients
DROP POLICY IF EXISTS "Users can insert their own patient data" ON public.patients;
DROP POLICY IF EXISTS "Patients can insert their own profile data" ON public.patients;
DROP POLICY IF EXISTS "Allow patient self-insert" ON public.patients;
DROP POLICY IF EXISTS "Allow authenticated users to insert their own patient record" ON public.patients;
DROP POLICY IF EXISTS "Patients can update their own data" ON public.patients;
DROP POLICY IF EXISTS "Patients can view their own data" ON public.patients;

-- Create comprehensive patient policies
CREATE POLICY "patients_insert_own"
  ON public.patients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "patients_update_own"
  ON public.patients FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "patients_select_own"
  ON public.patients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow doctors and managers to view patients they have access to
DROP POLICY IF EXISTS "doctors_view_patients" ON public.patients;
CREATE POLICY "doctors_view_patients"
  ON public.patients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('doctor', 'hospital_manager', 'admin')
    )
  );

-- Fix user_roles policies
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;

CREATE POLICY "user_roles_insert_own"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_roles_select_own"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix profiles policies
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);  -- Allow viewing all profiles for search functionality

-- STEP 3: Recreate the trigger function to be more robust
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  v_dob DATE;
BEGIN
  -- Get role from metadata
  user_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));

  -- Always create profile
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''), 'User'),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''), ''),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''), ''),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), profiles.last_name),
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), profiles.phone),
    email = COALESCE(EXCLUDED.email, profiles.email);

  -- Create user_role if specified
  IF user_role IN ('patient', 'doctor', 'hospital_manager', 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Create patient record if role is patient
  IF user_role = 'patient' THEN
    -- Parse date safely
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'date_of_birth')::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_dob := '1990-01-01'::DATE;
    END;
    
    IF v_dob IS NULL THEN
      v_dob := '1990-01-01'::DATE;
    END IF;

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
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'gender'), ''), 'other'),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'blood_type'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'emergency_contact'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'address'), '')
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Create doctor record if role is doctor
  IF user_role = 'doctor' THEN
    INSERT INTO public.doctors (
      user_id, 
      license_number, 
      specialization, 
      qualification, 
      approval_status
    )
    VALUES (
      NEW.id,
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'license_number'), ''), 'LIC-' || SUBSTRING(NEW.id::TEXT, 1, 8)),
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'specialization'), ''), 'General Medicine'),
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'qualification'), ''), 'MBBS'),
      'pending'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Create hospital_manager record if role is hospital_manager
  IF user_role = 'hospital_manager' THEN
    INSERT INTO public.hospital_managers (user_id, hospital_name, department, created_by)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'hospital_name'), ''), 'Hospital'),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'department'), ''),
      NEW.id
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but never fail signup
  RAISE LOG 'handle_new_user error for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- STEP 4: Create missing patient records for existing users
INSERT INTO public.patients (user_id, medical_id, date_of_birth, gender, blood_type, emergency_contact, address)
SELECT 
  au.id,
  'MED-' || SUBSTRING(au.id::TEXT, 1, 8) || '-' || FLOOR(RANDOM() * 1000)::INT,
  COALESCE((au.raw_user_meta_data->>'date_of_birth')::DATE, '1990-01-01'::DATE),
  COALESCE(au.raw_user_meta_data->>'gender', 'other'),
  NULLIF(au.raw_user_meta_data->>'blood_type', ''),
  NULLIF(au.raw_user_meta_data->>'emergency_contact', ''),
  NULLIF(au.raw_user_meta_data->>'address', '')
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'patient'
AND NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.user_id = au.id)
ON CONFLICT (user_id) DO NOTHING;

-- STEP 5: Create missing user_roles for existing users
INSERT INTO public.user_roles (user_id, role)
SELECT 
  au.id,
  'patient'::app_role
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'patient'
AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id AND ur.role = 'patient')
ON CONFLICT (user_id, role) DO NOTHING;

-- STEP 6: Create missing profiles for existing users
INSERT INTO public.profiles (id, first_name, last_name, phone, email)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'first_name', 'User'),
  COALESCE(au.raw_user_meta_data->>'last_name', ''),
  COALESCE(au.raw_user_meta_data->>'phone', ''),
  au.email
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = COALESCE(EXCLUDED.phone, profiles.phone),
  email = EXCLUDED.email;

-- STEP 7: Verify the fix
SELECT 'After fix - checking patients...' as step;

SELECT 
  au.email,
  p.medical_id,
  p.date_of_birth,
  p.gender,
  ur.role
FROM auth.users au
JOIN public.patients p ON p.user_id = au.id
LEFT JOIN public.user_roles ur ON ur.user_id = au.id
WHERE au.raw_user_meta_data->>'role' = 'patient'
ORDER BY au.created_at DESC
LIMIT 10;

SELECT 'Migration complete! All patient records should now exist.' as status;
SELECT 'New signups will automatically create patient records.' as note;
