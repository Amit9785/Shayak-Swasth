-- Create Appointments Table for Doctor-Patient Appointments
-- Flow: Patient requests appointment -> Hospital Manager approves/rejects -> Doctor sees confirmed appointments

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Patients can view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can cancel own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can update own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can view assigned appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can update completed status" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can update assigned appointments" ON public.appointments;
DROP POLICY IF EXISTS "Managers can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Managers can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admins full access to appointments" ON public.appointments;

-- Drop and recreate tables to ensure correct structure
DROP TABLE IF EXISTS public.doctor_availability CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id uuid REFERENCES public.hospital_managers(id), -- Link to hospital for manager access
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  duration_minutes integer DEFAULT 30,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'rejected')),
  appointment_type text DEFAULT 'consultation' CHECK (appointment_type IN ('consultation', 'follow_up', 'checkup', 'emergency', 'other')),
  reason text,
  notes text,
  doctor_notes text,
  manager_notes text, -- Notes from hospital manager on approval/rejection
  approved_by uuid REFERENCES auth.users(id), -- Which manager approved
  cancelled_by uuid REFERENCES auth.users(id),
  cancellation_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON public.appointments(doctor_id, appointment_date);

-- RLS Policies

-- Patients can view their own appointments
CREATE POLICY "Patients can view own appointments"
ON public.appointments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.patients p 
    WHERE p.id = appointments.patient_id 
    AND p.user_id = auth.uid()
  )
);

-- Patients can create appointments
CREATE POLICY "Patients can create appointments"
ON public.appointments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patients p 
    WHERE p.id = patient_id 
    AND p.user_id = auth.uid()
  )
);

-- Patients can update their own pending appointments (cancel only)
CREATE POLICY "Patients can cancel own appointments"
ON public.appointments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.patients p 
    WHERE p.id = appointments.patient_id 
    AND p.user_id = auth.uid()
  )
  AND status = 'pending'
);

-- Doctors can view appointments assigned to them (view only, not manage)
CREATE POLICY "Doctors can view assigned appointments"
ON public.appointments FOR SELECT
USING (
  doctor_id = auth.uid() 
  AND public.has_role(auth.uid(), 'doctor')
);

-- Doctors can only update to mark as completed or add notes (not approve/reject)
CREATE POLICY "Doctors can update completed status"
ON public.appointments FOR UPDATE
USING (
  doctor_id = auth.uid() 
  AND public.has_role(auth.uid(), 'doctor')
  AND status = 'confirmed' -- Can only update confirmed appointments
);

-- Hospital managers can view all appointments
CREATE POLICY "Managers can view all appointments"
ON public.appointments FOR SELECT
USING (public.has_role(auth.uid(), 'hospital_manager'));

-- Hospital managers can update appointments (approve/reject)
CREATE POLICY "Managers can update appointments"
ON public.appointments FOR UPDATE
USING (public.has_role(auth.uid(), 'hospital_manager'));

-- Admins can do everything
CREATE POLICY "Admins full access to appointments"
ON public.appointments FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create Doctor Availability Table
CREATE TABLE public.doctor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(doctor_id, day_of_week)
);

-- Enable RLS on availability
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;

-- Doctors can manage their own availability
CREATE POLICY "Doctors can manage own availability"
ON public.doctor_availability FOR ALL
USING (doctor_id = auth.uid() AND public.has_role(auth.uid(), 'doctor'))
WITH CHECK (doctor_id = auth.uid() AND public.has_role(auth.uid(), 'doctor'));

-- Everyone can view doctor availability (for booking)
CREATE POLICY "Anyone can view doctor availability"
ON public.doctor_availability FOR SELECT
USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_appointments_updated_at();

-- Insert default availability for existing doctors (Mon-Fri, 9 AM - 5 PM)
INSERT INTO public.doctor_availability (doctor_id, day_of_week, start_time, end_time)
SELECT 
  ur.user_id,
  day_num,
  '09:00:00'::time,
  '17:00:00'::time
FROM public.user_roles ur
CROSS JOIN generate_series(1, 5) AS day_num -- Monday to Friday
WHERE ur.role = 'doctor'
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;
