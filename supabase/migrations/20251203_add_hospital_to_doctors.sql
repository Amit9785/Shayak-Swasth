-- Add hospital_id to doctors table to link doctors to hospitals
ALTER TABLE public.doctors 
ADD COLUMN IF NOT EXISTS hospital_id uuid REFERENCES public.hospital_managers(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_doctors_hospital ON public.doctors(hospital_id);

-- Update appointments table to auto-fill hospital_id based on doctor's hospital
-- This helps hospital managers see only their hospital's appointments

