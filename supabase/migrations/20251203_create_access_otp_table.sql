-- Create a general OTP table for patient record access
-- This can be used by doctors, managers, or any authorized requester

CREATE TABLE IF NOT EXISTS public.access_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_type text NOT NULL CHECK (requester_type IN ('doctor', 'hospital_manager', 'admin')),
  otp_code text NOT NULL,
  phone_number text NOT NULL,
  purpose text NOT NULL DEFAULT 'record_access',
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.access_otp ENABLE ROW LEVEL SECURITY;

-- Policies
-- Requesters can view their own OTPs
CREATE POLICY "Requesters can view own OTPs"
ON public.access_otp FOR SELECT
USING (auth.uid() = requester_id);

-- Doctors can insert OTPs for their access requests
CREATE POLICY "Doctors can create access OTPs"
ON public.access_otp FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'doctor') 
  AND auth.uid() = requester_id
  AND requester_type = 'doctor'
);

-- Hospital managers can create access OTPs
CREATE POLICY "Managers can create access OTPs"
ON public.access_otp FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'hospital_manager') 
  AND auth.uid() = requester_id
  AND requester_type = 'hospital_manager'
);

-- Allow updating verified/used status
CREATE POLICY "Requesters can update own OTPs"
ON public.access_otp FOR UPDATE
USING (auth.uid() = requester_id)
WITH CHECK (auth.uid() = requester_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_access_otp_patient ON public.access_otp(patient_id);
CREATE INDEX IF NOT EXISTS idx_access_otp_requester ON public.access_otp(requester_id);
CREATE INDEX IF NOT EXISTS idx_access_otp_lookup ON public.access_otp(patient_id, otp_code, verified, used, expires_at);

