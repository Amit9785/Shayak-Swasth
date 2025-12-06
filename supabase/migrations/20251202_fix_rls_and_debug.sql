-- =====================================================
-- FIX RLS POLICIES AND ADD MISSING PATIENT DATA
-- Run this to ensure doctors and hospital managers
-- can view patients, and fix patient signup issues
-- =====================================================

-- Step 0: First, let's add the missing records for existing users
-- Insert patient data for existing patient user (if not exists)
INSERT INTO public.patients (user_id, medical_id, date_of_birth, gender)
SELECT 
  ur.user_id,
  'MED' || EXTRACT(EPOCH FROM NOW())::BIGINT || floor(random() * 1000)::INT,
  '1990-01-01'::DATE,
  'other'
FROM public.user_roles ur
WHERE ur.role = 'patient'
AND NOT EXISTS (
  SELECT 1 FROM public.patients p WHERE p.user_id = ur.user_id
);

-- Insert doctor data for existing doctor users (if not exists)
INSERT INTO public.doctors (user_id, license_number, specialization, qualification, approval_status)
SELECT 
  ur.user_id,
  'LIC' || EXTRACT(EPOCH FROM NOW())::BIGINT || floor(random() * 1000)::INT,
  'General Medicine',
  'MBBS',
  'approved'
FROM public.user_roles ur
WHERE ur.role = 'doctor'
AND NOT EXISTS (
  SELECT 1 FROM public.doctors d WHERE d.user_id = ur.user_id
);

-- Insert hospital_manager data for existing manager users (if not exists)
INSERT INTO public.hospital_managers (user_id, hospital_name, created_by)
SELECT 
  ur.user_id,
  'Default Hospital',
  ur.user_id
FROM public.user_roles ur
WHERE ur.role = 'hospital_manager'
AND NOT EXISTS (
  SELECT 1 FROM public.hospital_managers hm WHERE hm.user_id = ur.user_id
);

-- Step 1: Ensure the has_role function exists and works correctly
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Step 2: Fix patients INSERT policy - allow users to insert their own patient record
DROP POLICY IF EXISTS "Patients can insert their own profile data" ON public.patients;
DROP POLICY IF EXISTS "Users can insert their own patient data" ON public.patients;

-- Allow any authenticated user to insert their own patient record
CREATE POLICY "Users can insert their own patient data"
  ON public.patients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Step 3: Drop and recreate patients SELECT policies to ensure they're correct
DROP POLICY IF EXISTS "Patients can view their own data" ON public.patients;
DROP POLICY IF EXISTS "Doctors can view all patients" ON public.patients;
DROP POLICY IF EXISTS "Hospital managers can view all patients" ON public.patients;
DROP POLICY IF EXISTS "Admins can view all patients" ON public.patients;

-- Patients can view their own data
CREATE POLICY "Patients can view their own data"
  ON public.patients FOR SELECT
  USING (auth.uid() = user_id);

-- Doctors can view all patients
CREATE POLICY "Doctors can view all patients"
  ON public.patients FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

-- Hospital managers can view all patients
CREATE POLICY "Hospital managers can view all patients"
  ON public.patients FOR SELECT
  USING (public.has_role(auth.uid(), 'hospital_manager'));

-- Admins can view all patients
CREATE POLICY "Admins can view all patients"
  ON public.patients FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Step 4: Ensure profiles can be viewed by doctors/managers
DROP POLICY IF EXISTS "Doctors can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Hospital managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Doctors can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "Hospital managers can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'hospital_manager'));

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- VERIFY: Check that patients now exist
-- =====================================================
-- SELECT * FROM public.patients;

-- =====================================================
-- FIX MANAGER OTP RLS POLICIES
-- Allow managers to create and manage their own OTPs
-- =====================================================

-- Drop existing OTP policies if they exist
DROP POLICY IF EXISTS "Managers can view own OTPs" ON public.manager_otp;
DROP POLICY IF EXISTS "Managers can create own OTPs" ON public.manager_otp;
DROP POLICY IF EXISTS "Managers can update own OTPs" ON public.manager_otp;
DROP POLICY IF EXISTS "Service role can manage OTPs" ON public.manager_otp;

-- Managers can view their own OTPs
CREATE POLICY "Managers can view own OTPs"
  ON public.manager_otp FOR SELECT
  USING (auth.uid() = manager_id);

-- Managers can create their own OTPs
CREATE POLICY "Managers can create own OTPs"
  ON public.manager_otp FOR INSERT
  WITH CHECK (auth.uid() = manager_id);

-- Managers can update their own OTPs (for verification)
CREATE POLICY "Managers can update own OTPs"
  ON public.manager_otp FOR UPDATE
  USING (auth.uid() = manager_id);

-- Add phone column to profiles if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN phone TEXT;
  END IF;
END $$;

-- =====================================================
-- FIX PROFILES RLS POLICIES FOR SIGNUP
-- Allow users to insert/update their own profile
-- =====================================================

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can upsert their own profile" ON public.profiles;

-- Allow users to insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile  
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- =====================================================
-- FIX USER_ROLES RLS POLICIES FOR SIGNUP
-- Allow users to insert their own role
-- =====================================================

DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;

-- Allow authenticated users to insert their own role
CREATE POLICY "Users can insert their own role"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- UPDATE TRIGGER TO GET PHONE FROM METADATA
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone)
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone);
  RETURN NEW;
END;
$$;

-- =====================================================
-- FIX DOCTORS RLS POLICIES FOR SIGNUP
-- Allow users to insert their own doctor record
-- =====================================================

DROP POLICY IF EXISTS "Users can insert their own doctor record" ON public.doctors;

CREATE POLICY "Users can insert their own doctor record"
  ON public.doctors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- FIX HOSPITAL_MANAGERS RLS POLICIES FOR SIGNUP
-- Allow users to insert their own hospital manager record
-- =====================================================

DROP POLICY IF EXISTS "Users can insert their own manager record" ON public.hospital_managers;

CREATE POLICY "Users can insert their own manager record"
  ON public.hospital_managers FOR INSERT
  WITH CHECK (auth.uid() = user_id);
