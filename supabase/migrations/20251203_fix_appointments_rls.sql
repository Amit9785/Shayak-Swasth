-- =====================================================
-- FIX APPOINTMENTS RLS POLICIES
-- Allow managers to approve/reject and doctors to complete
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Patients can view their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can view their appointments" ON public.appointments;
DROP POLICY IF EXISTS "Managers can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Managers can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can update appointments" ON public.appointments;

-- Also drop these (ensure names match created policy names)
DROP POLICY IF EXISTS "Managers can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Managers can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admins can update all appointments" ON public.appointments;

-- Patients can view their own appointments
CREATE POLICY "Patients can view their own appointments"
ON public.appointments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = appointments.patient_id
    AND patients.user_id = auth.uid()
  )
);

-- Patients can create appointments
CREATE POLICY "Patients can create appointments"
ON public.appointments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = patient_id
    AND patients.user_id = auth.uid()
  )
);

-- Doctors can view appointments where they are the doctor
CREATE POLICY "Doctors can view their appointments"
ON public.appointments FOR SELECT
USING (doctor_id = auth.uid());

-- Doctors can update their appointments (mark complete)
CREATE POLICY "Doctors can update their appointments"
ON public.appointments FOR UPDATE
USING (doctor_id = auth.uid());

-- Hospital Managers can view all appointments
CREATE POLICY "Managers can view all appointments"
ON public.appointments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'hospital_manager'
  )
);

-- Hospital Managers can update appointments (approve/reject)
CREATE POLICY "Managers can update appointments"
ON public.appointments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'hospital_manager'
  )
);

-- Admins can view all appointments
CREATE POLICY "Admins can view all appointments"
ON public.appointments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Admins can update all appointments
CREATE POLICY "Admins can update all appointments"
ON public.appointments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

SELECT 'Appointments RLS policies fixed!' as result;
