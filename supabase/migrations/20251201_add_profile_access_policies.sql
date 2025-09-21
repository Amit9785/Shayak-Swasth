-- =====================================================
-- PROFILE ACCESS POLICIES
-- Doctors and Hospital Managers can view patient profiles
-- (basic info like name) but NOT detailed medical records
-- without patient authorization
-- =====================================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Doctors can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Hospital managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Allow doctors to view all profiles (basic info only)
CREATE POLICY "Doctors can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

-- Allow hospital managers to view all profiles (basic info only)
CREATE POLICY "Hospital managers can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'hospital_manager'));

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- RESTRICT RECORDS ACCESS
-- Drop existing permissive policies and create restricted ones
-- Doctors/Managers can only view records they have been granted access to
-- =====================================================

-- Drop the overly permissive policies first
DROP POLICY IF EXISTS "Doctors can view all records" ON public.records;
DROP POLICY IF EXISTS "Hospital managers can view all records" ON public.records;
DROP POLICY IF EXISTS "Doctors can view authorized records only" ON public.records;
DROP POLICY IF EXISTS "Hospital managers can view authorized records only" ON public.records;

-- Add patient_id column to shared_access if it doesn't exist (for granting access to all patient records)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shared_access' 
    AND column_name = 'patient_id'
  ) THEN
    ALTER TABLE public.shared_access ADD COLUMN patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE;
    -- Make record_id nullable since we can grant access via patient_id
    ALTER TABLE public.shared_access ALTER COLUMN record_id DROP NOT NULL;
  END IF;
END $$;

-- Add access_type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shared_access' 
    AND column_name = 'access_type'
  ) THEN
    ALTER TABLE public.shared_access ADD COLUMN access_type TEXT DEFAULT 'view';
  END IF;
END $$;

-- Note: shared_access table already has these columns from original migration:
-- - shared_with_user_id (the user who receives access)
-- - shared_by_user_id (the patient who grants access)
-- - expires_at (when access expires)

-- Drop existing shared_access policies if they exist
DROP POLICY IF EXISTS "Users can view records shared with them" ON public.shared_access;
DROP POLICY IF EXISTS "Patients can share their own records" ON public.shared_access;
DROP POLICY IF EXISTS "Patients can view shared access for their records" ON public.shared_access;
DROP POLICY IF EXISTS "Patients can grant access to their records" ON public.shared_access;
DROP POLICY IF EXISTS "Patients can revoke access to their records" ON public.shared_access;
DROP POLICY IF EXISTS "Users can view access granted to them" ON public.shared_access;

-- Patients can view shared access they created
CREATE POLICY "Patients can view shared access for their records"
  ON public.shared_access FOR SELECT
  USING (shared_by_user_id = auth.uid());

-- Patients can grant access to their records
CREATE POLICY "Patients can grant access to their records"
  ON public.shared_access FOR INSERT
  WITH CHECK (
    shared_by_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.patients
      WHERE patients.user_id = auth.uid()
      AND (
        shared_access.patient_id = patients.id OR 
        EXISTS (
          SELECT 1 FROM public.records 
          WHERE records.id = shared_access.record_id 
          AND records.patient_id = patients.id
        )
      )
    )
  );

-- Patients can revoke access they granted
CREATE POLICY "Patients can revoke access to their records"
  ON public.shared_access FOR DELETE
  USING (shared_by_user_id = auth.uid());

-- Doctors/Managers can view access granted to them
CREATE POLICY "Users can view access granted to them"
  ON public.shared_access FOR SELECT
  USING (shared_with_user_id = auth.uid());

-- NEW: Doctors can only view records they have been granted access to
CREATE POLICY "Doctors can view authorized records only"
  ON public.records FOR SELECT
  USING (
    public.has_role(auth.uid(), 'doctor') AND
    EXISTS (
      SELECT 1 FROM public.shared_access
      WHERE (
        shared_access.record_id = records.id OR 
        shared_access.patient_id = records.patient_id
      )
      AND shared_access.shared_with_user_id = auth.uid()
      AND (shared_access.expires_at IS NULL OR shared_access.expires_at > NOW())
    )
  );

-- NEW: Hospital managers can only view records they have been granted access to
CREATE POLICY "Hospital managers can view authorized records only"
  ON public.records FOR SELECT
  USING (
    public.has_role(auth.uid(), 'hospital_manager') AND
    EXISTS (
      SELECT 1 FROM public.shared_access
      WHERE (
        shared_access.record_id = records.id OR 
        shared_access.patient_id = records.patient_id
      )
      AND shared_access.shared_with_user_id = auth.uid()
      AND (shared_access.expires_at IS NULL OR shared_access.expires_at > NOW())
    )
  );

