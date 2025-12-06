-- =====================================================
-- COMPLETE FIX FOR DOCTOR APPROVAL FLOW
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- STEP 1: Check if doctors table has pending doctors
-- (This will show what's currently in the table)
SELECT 'Current doctors in database:' as info;
SELECT d.id, d.user_id, d.license_number, d.specialization, d.approval_status, 
       p.first_name, p.last_name, p.email
FROM doctors d
LEFT JOIN profiles p ON d.user_id = p.id;

-- STEP 2: Enable RLS on doctors table (if not already)
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- STEP 3: Drop existing policies on doctors table to start fresh
DROP POLICY IF EXISTS "Admins can view all doctors" ON public.doctors;
DROP POLICY IF EXISTS "Admins can update doctors" ON public.doctors;
DROP POLICY IF EXISTS "Users can insert their own doctor record" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can view their own profile" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can update their own profile" ON public.doctors;
DROP POLICY IF EXISTS "Anyone can view approved doctors" ON public.doctors;

-- STEP 4: Create all necessary RLS policies for doctors

-- Admins can view ALL doctors (including pending)
CREATE POLICY "Admins can view all doctors"
ON public.doctors FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Admins can update doctors (for approval/rejection)
CREATE POLICY "Admins can update doctors"
ON public.doctors FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Users can insert their own doctor record during signup
CREATE POLICY "Users can insert their own doctor record"
ON public.doctors FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Doctors can view their own profile
CREATE POLICY "Doctors can view their own profile"
ON public.doctors FOR SELECT
USING (auth.uid() = user_id);

-- Doctors can update their own profile
CREATE POLICY "Doctors can update their own profile"
ON public.doctors FOR UPDATE
USING (auth.uid() = user_id);

-- Anyone can view approved doctors (for booking appointments)
CREATE POLICY "Anyone can view approved doctors"
ON public.doctors FOR SELECT
USING (approval_status = 'approved');

-- STEP 5: Ensure the trigger function exists and creates doctor records
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Insert/Update profile
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

    -- DOCTOR: Create doctor record with pending status
    IF user_role = 'doctor' THEN
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

    -- PATIENT: Create patient record
    ELSIF user_role = 'patient' THEN
      INSERT INTO public.patients (user_id, medical_id, date_of_birth, gender)
      VALUES (
        NEW.id,
        'MED' || EXTRACT(EPOCH FROM NOW())::BIGINT || floor(random() * 1000)::INT,
        COALESCE((NEW.raw_user_meta_data->>'date_of_birth')::DATE, '1990-01-01'),
        COALESCE(NEW.raw_user_meta_data->>'gender', 'other')
      )
      ON CONFLICT (user_id) DO NOTHING;

    -- HOSPITAL MANAGER: Create manager record
    ELSIF user_role = 'hospital_manager' THEN
      INSERT INTO public.hospital_managers (user_id, hospital_name, department, created_by)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'hospital_name', 'Unknown Hospital'),
        NEW.raw_user_meta_data->>'department',
        NEW.id
      )
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- STEP 6: Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- STEP 7: Verify the fix
SELECT 'Policies on doctors table:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'doctors';

SELECT 'Done! Now try signing up a new doctor.' as result;
