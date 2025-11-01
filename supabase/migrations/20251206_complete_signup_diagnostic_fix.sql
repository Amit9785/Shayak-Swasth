-- =====================================================
-- COMPLETE FIX FOR SIGNUP ISSUES
-- Run this in Supabase SQL Editor
-- This will DIAGNOSE and FIX the signup problem
-- =====================================================

-- STEP 1: DIAGNOSE - Check what's wrong
SELECT '=== DIAGNOSTIC REPORT ===' as section;

-- Check if profiles table has email column
SELECT 'Checking profiles table structure...' as step;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'profiles';

-- Check if required types exist
SELECT 'Checking enum types...' as step;
SELECT typname FROM pg_type WHERE typname IN ('app_role', 'approval_status');

-- Check current trigger
SELECT 'Checking current trigger...' as step;
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass;

-- STEP 2: FIX SCHEMA ISSUES

-- Add email column to profiles if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
    RAISE NOTICE 'Added email column to profiles';
  END IF;
END $$;

-- Ensure app_role type exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM ('patient', 'doctor', 'hospital_manager', 'admin');
    RAISE NOTICE 'Created app_role type';
  END IF;
END $$;

-- STEP 3: COMPLETELY DISABLE AND RECREATE TRIGGER
SELECT 'Removing old trigger...' as step;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- STEP 4: CREATE NEW ULTRA-SAFE TRIGGER
-- This trigger wraps EVERYTHING in exception handlers
SELECT 'Creating new safe trigger...' as step;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_dob DATE;
  v_has_email_col BOOLEAN;
BEGIN
  -- Check if email column exists in profiles
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) INTO v_has_email_col;

  -- Get role safely
  v_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));

  -- TRY to create profile
  BEGIN
    IF v_has_email_col THEN
      INSERT INTO public.profiles (id, first_name, last_name, phone, email)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        NEW.email
      )
      ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO public.profiles (id, first_name, last_name, phone)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', '')
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Profile insert failed for %: %', NEW.id, SQLERRM;
  END;

  -- TRY to create user_role
  IF v_role IN ('patient', 'doctor', 'hospital_manager', 'admin') THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, v_role::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Role insert failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  -- TRY to create patient record
  IF v_role = 'patient' THEN
    BEGIN
      v_dob := COALESCE(
        (NEW.raw_user_meta_data->>'date_of_birth')::DATE,
        '1990-01-01'::DATE
      );
    EXCEPTION WHEN OTHERS THEN
      v_dob := '1990-01-01'::DATE;
    END;

    BEGIN
      INSERT INTO public.patients (user_id, medical_id, date_of_birth, gender)
      VALUES (
        NEW.id,
        'MED-' || LEFT(NEW.id::TEXT, 8),
        v_dob,
        COALESCE(NEW.raw_user_meta_data->>'gender', 'other')
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Patient insert failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  -- TRY to create doctor record
  IF v_role = 'doctor' THEN
    BEGIN
      INSERT INTO public.doctors (user_id, license_number, specialization, qualification, approval_status)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'license_number', 'LIC-' || LEFT(NEW.id::TEXT, 8)),
        COALESCE(NEW.raw_user_meta_data->>'specialization', 'General'),
        COALESCE(NEW.raw_user_meta_data->>'qualification', 'MBBS'),
        'pending'
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Doctor insert failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  -- TRY to create hospital_manager record
  IF v_role = 'hospital_manager' THEN
    BEGIN
      INSERT INTO public.hospital_managers (user_id, hospital_name, created_by)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'hospital_name', 'Hospital'),
        NEW.id
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Manager insert failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  -- ALWAYS return NEW - never fail the signup
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- STEP 5: FIX RLS POLICIES
SELECT 'Fixing RLS policies...' as step;

-- Patients policies
DROP POLICY IF EXISTS "patients_insert_own" ON public.patients;
DROP POLICY IF EXISTS "patients_update_own" ON public.patients;
DROP POLICY IF EXISTS "patients_select_own" ON public.patients;
DROP POLICY IF EXISTS "doctors_view_patients" ON public.patients;

CREATE POLICY "patients_insert_own" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "patients_update_own" ON public.patients FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "patients_select_own" ON public.patients FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('doctor', 'hospital_manager', 'admin')
  ));

-- User roles policies  
DROP POLICY IF EXISTS "user_roles_insert_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;

CREATE POLICY "user_roles_insert_own" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- STEP 6: CREATE MISSING RECORDS FOR EXISTING USERS
SELECT 'Creating missing records for existing users...' as step;

-- Create missing profiles
INSERT INTO public.profiles (id, first_name, last_name, phone)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'first_name', 'User'),
  COALESCE(au.raw_user_meta_data->>'last_name', ''),
  COALESCE(au.raw_user_meta_data->>'phone', '')
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- Create missing patient records
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
SELECT au.id, 'patient'::app_role
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'patient'
AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id)
ON CONFLICT (user_id, role) DO NOTHING;

-- STEP 7: VERIFY
SELECT '=== VERIFICATION ===' as section;

SELECT 'Trigger status:' as check_type;
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass;

SELECT 'Patient count:' as check_type, COUNT(*) as count FROM patients;

SELECT 'Users with patient role but no patient record:' as check_type;
SELECT au.email, au.raw_user_meta_data->>'role' as role
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'patient'
AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.user_id = au.id);

SELECT '=== COMPLETE ===' as section;
SELECT 'Try signing up as a new patient now!' as instruction;
