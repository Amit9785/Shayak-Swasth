-- =====================================================
-- COMPLETE SIGNUP FIX
-- This migration ensures ALL signup data is properly saved
-- automatically to the correct tables
-- =====================================================

-- =====================================================
-- STEP 1: Add email column to profiles if not exists
-- =====================================================
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

-- =====================================================
-- STEP 2: FIX RLS POLICIES TO ALLOW SIGNUP INSERTS
-- =====================================================

-- Profiles: Allow users to insert/update their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- User Roles: Allow users to insert their own role
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;

CREATE POLICY "Users can insert their own role"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Patients: Allow users to insert/update their own patient record
DROP POLICY IF EXISTS "Users can insert their own patient data" ON public.patients;
DROP POLICY IF EXISTS "Patients can insert their own profile data" ON public.patients;
DROP POLICY IF EXISTS "Patients can update their own data" ON public.patients;

CREATE POLICY "Users can insert their own patient data"
  ON public.patients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Patients can update their own data"
  ON public.patients FOR UPDATE
  USING (auth.uid() = user_id);

-- Doctors: Allow users to insert/update their own doctor record
DROP POLICY IF EXISTS "Users can insert their own doctor record" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can update their own profile" ON public.doctors;

CREATE POLICY "Users can insert their own doctor record"
  ON public.doctors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Doctors can update their own profile"
  ON public.doctors FOR UPDATE
  USING (auth.uid() = user_id);

-- Hospital Managers: Allow users to insert/update their own manager record
DROP POLICY IF EXISTS "Users can insert their own manager record" ON public.hospital_managers;
DROP POLICY IF EXISTS "Managers can update their own profile" ON public.hospital_managers;

CREATE POLICY "Users can insert their own manager record"
  ON public.hospital_managers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can update their own profile"
  ON public.hospital_managers FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- STEP 3: UPDATE TRIGGER TO AUTO-SAVE ALL SIGNUP DATA
-- This trigger runs when a new user signs up and saves
-- ALL form data to the appropriate tables
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Insert/Update profile with ALL user data
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

  -- Get the role from metadata
  user_role := NEW.raw_user_meta_data->>'role';

  -- Insert user role if specified
  IF user_role IS NOT NULL AND user_role != '' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- =========================================
    -- PATIENT: Save all patient form data
    -- =========================================
    IF user_role = 'patient' THEN
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
        'MED' || EXTRACT(EPOCH FROM NOW())::BIGINT || floor(random() * 1000)::INT,
        CASE 
          WHEN NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL 
               AND NEW.raw_user_meta_data->>'date_of_birth' != ''
          THEN (NEW.raw_user_meta_data->>'date_of_birth')::DATE
          ELSE '1990-01-01'::DATE
        END,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'gender', ''), 'other'),
        NULLIF(NEW.raw_user_meta_data->>'blood_type', ''),
        NULLIF(NEW.raw_user_meta_data->>'emergency_contact', ''),
        NULLIF(NEW.raw_user_meta_data->>'address', '')
      )
      ON CONFLICT (user_id) DO UPDATE SET
        date_of_birth = COALESCE(EXCLUDED.date_of_birth, patients.date_of_birth),
        gender = COALESCE(NULLIF(EXCLUDED.gender, 'other'), patients.gender),
        blood_type = COALESCE(EXCLUDED.blood_type, patients.blood_type),
        emergency_contact = COALESCE(EXCLUDED.emergency_contact, patients.emergency_contact),
        address = COALESCE(EXCLUDED.address, patients.address);

    -- =========================================
    -- DOCTOR: Save all doctor form data
    -- =========================================
    ELSIF user_role = 'doctor' THEN
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
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'license_number', ''), 'LIC' || EXTRACT(EPOCH FROM NOW())::BIGINT),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'specialization', ''), 'General Medicine'),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'qualification', ''), 'MBBS'),
        CASE 
          WHEN NEW.raw_user_meta_data->>'experience_years' IS NOT NULL 
               AND NEW.raw_user_meta_data->>'experience_years' != ''
          THEN (NEW.raw_user_meta_data->>'experience_years')::INT
          ELSE NULL
        END,
        'pending'::approval_status
      )
      ON CONFLICT (user_id) DO UPDATE SET
        license_number = COALESCE(NULLIF(EXCLUDED.license_number, ''), doctors.license_number),
        specialization = COALESCE(NULLIF(EXCLUDED.specialization, ''), doctors.specialization),
        qualification = COALESCE(NULLIF(EXCLUDED.qualification, ''), doctors.qualification),
        experience_years = COALESCE(EXCLUDED.experience_years, doctors.experience_years);

    -- =========================================
    -- HOSPITAL MANAGER: Save all manager form data
    -- =========================================
    ELSIF user_role = 'hospital_manager' THEN
      INSERT INTO public.hospital_managers (
        user_id, 
        hospital_name, 
        department, 
        created_by
      )
      VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'hospital_name', ''), 'Default Hospital'),
        NULLIF(NEW.raw_user_meta_data->>'department', ''),
        NEW.id
      )
      ON CONFLICT (user_id) DO UPDATE SET
        hospital_name = COALESCE(NULLIF(EXCLUDED.hospital_name, ''), hospital_managers.hospital_name),
        department = COALESCE(EXCLUDED.department, hospital_managers.department);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists and is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- STEP 4: FIX EXISTING USERS WHO ARE MISSING RECORDS
-- =====================================================

-- Fix patients missing from patients table
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

-- Fix doctors missing from doctors table
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

-- Fix hospital managers missing from hospital_managers table
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

-- =====================================================
-- VERIFY: Check counts after fix
-- =====================================================
SELECT 'user_roles' as table_name, COUNT(*) as count FROM public.user_roles
UNION ALL
SELECT 'profiles', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'patients', COUNT(*) FROM public.patients
UNION ALL
SELECT 'doctors', COUNT(*) FROM public.doctors
UNION ALL
SELECT 'hospital_managers', COUNT(*) FROM public.hospital_managers;
