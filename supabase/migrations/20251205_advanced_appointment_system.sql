-- Advanced Appointment Booking System
-- Features:
-- 1. Time durations based on type (Consultation=5min, Checkup=10min, Follow-up=10min, Emergency=variable)
-- 2. Hospital Manager approval flow
-- 3. Emergency handling with appointment shifting
-- 4. Missed appointment handling with next day rescheduling

-- =============================================================================
-- STEP 1: Create appointment_status enum and type durations
-- =============================================================================

-- Drop existing appointment type check constraint
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_appointment_type_check;

-- Add new columns to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS original_time time, -- Store original time before emergency shift
ADD COLUMN IF NOT EXISTS original_date date, -- Store original date before emergency shift
ADD COLUMN IF NOT EXISTS shifted_due_to uuid REFERENCES public.appointments(id), -- Reference to emergency that caused shift
ADD COLUMN IF NOT EXISTS is_emergency_shift boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS requested_duration_minutes integer, -- For emergency - patient requested duration
ADD COLUMN IF NOT EXISTS actual_start_time timestamptz,
ADD COLUMN IF NOT EXISTS actual_end_time timestamptz,
ADD COLUMN IF NOT EXISTS missed_at timestamptz, -- When marked as no_show
ADD COLUMN IF NOT EXISTS rescheduled_from uuid REFERENCES public.appointments(id), -- Reference to original missed appointment
ADD COLUMN IF NOT EXISTS rescheduled_to uuid REFERENCES public.appointments(id); -- Reference to rescheduled appointment

-- Update duration_minutes default based on appointment type
ALTER TABLE public.appointments ALTER COLUMN duration_minutes DROP DEFAULT;

-- Add constraint for appointment types
ALTER TABLE public.appointments 
ADD CONSTRAINT appointments_appointment_type_check 
CHECK (appointment_type IN ('consultation', 'follow_up', 'checkup', 'emergency', 'other'));

-- =============================================================================
-- STEP 2: Create time slots table for granular slot management
-- =============================================================================

DROP TABLE IF EXISTS public.appointment_slots CASCADE;

CREATE TABLE public.appointment_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  slot_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'blocked', 'emergency_blocked')),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(doctor_id, slot_date, slot_time)
);

ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;

-- Anyone can view available slots
CREATE POLICY "Anyone can view slots"
ON public.appointment_slots FOR SELECT
USING (true);

-- Doctors can manage their slots
CREATE POLICY "Doctors can manage own slots"
ON public.appointment_slots FOR ALL
USING (doctor_id = auth.uid())
WITH CHECK (doctor_id = auth.uid());

-- Managers can update slots for approvals
CREATE POLICY "Managers can update slots"
ON public.appointment_slots FOR UPDATE
USING (public.has_role(auth.uid(), 'hospital_manager'));

-- Admins full access
CREATE POLICY "Admins full access to slots"
ON public.appointment_slots FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Index for fast slot lookups
CREATE INDEX idx_slots_doctor_date ON public.appointment_slots(doctor_id, slot_date);
CREATE INDEX idx_slots_status ON public.appointment_slots(status);

-- =============================================================================
-- STEP 3: Create function to get appointment duration by type
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_appointment_duration(p_type text)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN CASE p_type
    WHEN 'consultation' THEN 5
    WHEN 'follow_up' THEN 10
    WHEN 'checkup' THEN 10
    WHEN 'emergency' THEN 30 -- Default for emergency, can be overridden
    ELSE 10 -- Default
  END;
END;
$$;

-- =============================================================================
-- STEP 4: Create function to generate daily time slots for a doctor
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_doctor_slots(
  p_doctor_id uuid,
  p_date date,
  p_slot_duration integer DEFAULT 5
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_availability record;
  v_current_time time;
  v_day_of_week integer;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);
  
  -- Get doctor's availability for this day
  SELECT * INTO v_availability
  FROM public.doctor_availability
  WHERE doctor_id = p_doctor_id
    AND day_of_week = v_day_of_week
    AND is_available = true;
  
  IF NOT FOUND THEN
    RETURN; -- Doctor not available on this day
  END IF;
  
  -- Generate slots from start_time to end_time
  v_current_time := v_availability.start_time;
  
  WHILE v_current_time < v_availability.end_time LOOP
    INSERT INTO public.appointment_slots (doctor_id, slot_date, slot_time, duration_minutes, status)
    VALUES (p_doctor_id, p_date, v_current_time, p_slot_duration, 'available')
    ON CONFLICT (doctor_id, slot_date, slot_time) DO NOTHING;
    
    v_current_time := v_current_time + (p_slot_duration || ' minutes')::interval;
  END LOOP;
END;
$$;

-- =============================================================================
-- STEP 5: Create function to book appointment with proper slot allocation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_patient_id uuid,
  p_doctor_id uuid,
  p_date date,
  p_time time,
  p_type text,
  p_reason text DEFAULT NULL,
  p_emergency_duration integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_duration integer;
  v_appointment_id uuid;
  v_slots_needed integer;
  v_current_time time;
  v_slot record;
BEGIN
  -- Calculate duration
  IF p_type = 'emergency' AND p_emergency_duration IS NOT NULL THEN
    v_duration := p_emergency_duration;
  ELSE
    v_duration := public.get_appointment_duration(p_type);
  END IF;
  
  -- Calculate how many 5-minute slots we need
  v_slots_needed := CEIL(v_duration::numeric / 5);
  
  -- Check if all required slots are available
  IF EXISTS (
    SELECT 1 FROM public.appointment_slots
    WHERE doctor_id = p_doctor_id
      AND slot_date = p_date
      AND slot_time >= p_time
      AND slot_time < p_time + (v_duration || ' minutes')::interval
      AND status != 'available'
  ) THEN
    RAISE EXCEPTION 'One or more time slots are not available';
  END IF;
  
  -- Create the appointment (pending status - needs manager approval)
  INSERT INTO public.appointments (
    patient_id, doctor_id, appointment_date, appointment_time,
    duration_minutes, appointment_type, reason, status,
    requested_duration_minutes
  )
  VALUES (
    p_patient_id, p_doctor_id, p_date, p_time,
    v_duration, p_type, p_reason, 
    CASE WHEN p_type = 'emergency' THEN 'confirmed' ELSE 'pending' END,
    CASE WHEN p_type = 'emergency' THEN p_emergency_duration ELSE NULL END
  )
  RETURNING id INTO v_appointment_id;
  
  -- Mark slots as booked
  UPDATE public.appointment_slots
  SET status = 'booked', appointment_id = v_appointment_id
  WHERE doctor_id = p_doctor_id
    AND slot_date = p_date
    AND slot_time >= p_time
    AND slot_time < p_time + (v_duration || ' minutes')::interval
    AND status = 'available';
  
  -- For emergency appointments, handle shifting of other appointments
  IF p_type = 'emergency' THEN
    PERFORM public.handle_emergency_shift(v_appointment_id, p_doctor_id, p_date, p_time, v_duration);
  END IF;
  
  RETURN v_appointment_id;
END;
$$;

-- =============================================================================
-- STEP 6: Create function to handle emergency appointment shifts
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_emergency_shift(
  p_emergency_appointment_id uuid,
  p_doctor_id uuid,
  p_date date,
  p_emergency_time time,
  p_emergency_duration integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affected_appointment record;
  v_shift_interval interval := '30 minutes'::interval;
  v_new_time time;
  v_new_date date;
  v_slots_needed integer;
BEGIN
  -- Find all confirmed appointments that overlap with emergency time
  FOR v_affected_appointment IN
    SELECT a.* 
    FROM public.appointments a
    WHERE a.doctor_id = p_doctor_id
      AND a.appointment_date = p_date
      AND a.id != p_emergency_appointment_id
      AND a.status IN ('confirmed', 'pending')
      AND (
        -- Overlaps with emergency slot
        (a.appointment_time >= p_emergency_time AND a.appointment_time < p_emergency_time + (p_emergency_duration || ' minutes')::interval)
        OR
        (a.appointment_time + (a.duration_minutes || ' minutes')::interval > p_emergency_time AND a.appointment_time < p_emergency_time)
      )
    ORDER BY a.appointment_time
  LOOP
    -- Store original time if not already shifted
    IF v_affected_appointment.original_time IS NULL THEN
      UPDATE public.appointments
      SET original_time = appointment_time,
          original_date = appointment_date
      WHERE id = v_affected_appointment.id;
    END IF;
    
    -- Calculate new time (shift by 30 minutes from emergency end)
    v_new_time := p_emergency_time + (p_emergency_duration || ' minutes')::interval + v_shift_interval;
    v_new_date := p_date;
    
    -- If new time goes past end of day (after 6 PM), move to next available day
    IF v_new_time >= '18:00:00'::time THEN
      v_new_date := p_date + 1;
      v_new_time := '09:00:00'::time;
      
      -- Skip weekends
      WHILE EXTRACT(DOW FROM v_new_date) IN (0, 6) LOOP
        v_new_date := v_new_date + 1;
      END LOOP;
    END IF;
    
    -- Update the affected appointment
    UPDATE public.appointments
    SET appointment_time = v_new_time,
        appointment_date = v_new_date,
        shifted_due_to = p_emergency_appointment_id,
        is_emergency_shift = true,
        notes = COALESCE(notes, '') || ' [Shifted due to emergency. Original: ' || v_affected_appointment.appointment_date || ' ' || v_affected_appointment.appointment_time || ']'
    WHERE id = v_affected_appointment.id;
    
    -- Update slot allocations for the shifted appointment
    -- Free old slots
    UPDATE public.appointment_slots
    SET status = 'available', appointment_id = NULL
    WHERE appointment_id = v_affected_appointment.id;
    
    -- Book new slots (generate if needed)
    PERFORM public.generate_doctor_slots(p_doctor_id, v_new_date, 5);
    
    v_slots_needed := CEIL(v_affected_appointment.duration_minutes::numeric / 5);
    
    UPDATE public.appointment_slots
    SET status = 'booked', appointment_id = v_affected_appointment.id
    WHERE doctor_id = p_doctor_id
      AND slot_date = v_new_date
      AND slot_time >= v_new_time
      AND slot_time < v_new_time + (v_affected_appointment.duration_minutes || ' minutes')::interval
      AND status = 'available';
      
  END LOOP;
END;
$$;

-- =============================================================================
-- STEP 7: Create function to handle missed appointments (no_show)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_missed_appointment(
  p_appointment_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appointment record;
  v_next_date date;
  v_next_time time;
  v_new_appointment_id uuid;
BEGIN
  -- Get the appointment
  SELECT * INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  
  -- Mark as no_show
  UPDATE public.appointments
  SET status = 'no_show',
      missed_at = now()
  WHERE id = p_appointment_id;
  
  -- Free up the slots
  UPDATE public.appointment_slots
  SET status = 'available', appointment_id = NULL
  WHERE appointment_id = p_appointment_id;
  
  -- Find next available day (tomorrow or next working day)
  v_next_date := v_appointment.appointment_date + 1;
  
  -- Skip weekends
  WHILE EXTRACT(DOW FROM v_next_date) IN (0, 6) LOOP
    v_next_date := v_next_date + 1;
  END LOOP;
  
  -- Generate slots for next day if not exists
  PERFORM public.generate_doctor_slots(v_appointment.doctor_id, v_next_date, 5);
  
  -- Find first available slot on next day
  SELECT slot_time INTO v_next_time
  FROM public.appointment_slots
  WHERE doctor_id = v_appointment.doctor_id
    AND slot_date = v_next_date
    AND status = 'available'
  ORDER BY slot_time
  LIMIT 1;
  
  IF v_next_time IS NULL THEN
    -- No slots available, try next day
    v_next_date := v_next_date + 1;
    WHILE EXTRACT(DOW FROM v_next_date) IN (0, 6) LOOP
      v_next_date := v_next_date + 1;
    END LOOP;
    PERFORM public.generate_doctor_slots(v_appointment.doctor_id, v_next_date, 5);
    
    SELECT slot_time INTO v_next_time
    FROM public.appointment_slots
    WHERE doctor_id = v_appointment.doctor_id
      AND slot_date = v_next_date
      AND status = 'available'
    ORDER BY slot_time
    LIMIT 1;
  END IF;
  
  -- Create rescheduled appointment suggestion (pending patient confirmation)
  IF v_next_time IS NOT NULL THEN
    INSERT INTO public.appointments (
      patient_id, doctor_id, appointment_date, appointment_time,
      duration_minutes, appointment_type, reason, status,
      rescheduled_from, notes
    )
    VALUES (
      v_appointment.patient_id, v_appointment.doctor_id, v_next_date, v_next_time,
      v_appointment.duration_minutes, v_appointment.appointment_type, v_appointment.reason,
      'pending',
      p_appointment_id,
      'Auto-rescheduled from missed appointment on ' || v_appointment.appointment_date
    )
    RETURNING id INTO v_new_appointment_id;
    
    -- Link original to rescheduled
    UPDATE public.appointments
    SET rescheduled_to = v_new_appointment_id
    WHERE id = p_appointment_id;
    
    RETURN v_new_appointment_id;
  END IF;
  
  RETURN NULL;
END;
$$;

-- =============================================================================
-- STEP 8: Create function for manager to approve/reject appointments
-- =============================================================================

CREATE OR REPLACE FUNCTION public.manager_update_appointment(
  p_appointment_id uuid,
  p_action text, -- 'approve' or 'reject'
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_action = 'approve' THEN
    UPDATE public.appointments
    SET status = 'confirmed',
        approved_by = auth.uid(),
        manager_notes = p_notes,
        updated_at = now()
    WHERE id = p_appointment_id
      AND status = 'pending';
  ELSIF p_action = 'reject' THEN
    UPDATE public.appointments
    SET status = 'rejected',
        approved_by = auth.uid(),
        manager_notes = p_notes,
        updated_at = now()
    WHERE id = p_appointment_id
      AND status = 'pending';
    
    -- Free up the slots
    UPDATE public.appointment_slots
    SET status = 'available', appointment_id = NULL
    WHERE appointment_id = p_appointment_id;
  ELSE
    RAISE EXCEPTION 'Invalid action. Use approve or reject';
  END IF;
  
  RETURN FOUND;
END;
$$;

-- =============================================================================
-- STEP 9: Create view for available slots (for easier querying)
-- =============================================================================

CREATE OR REPLACE VIEW public.available_appointment_slots AS
SELECT 
  s.id as slot_id,
  s.doctor_id,
  p.first_name as doctor_first_name,
  p.last_name as doctor_last_name,
  d.specialization,
  s.slot_date,
  s.slot_time,
  s.duration_minutes,
  s.status
FROM public.appointment_slots s
JOIN public.doctors d ON d.user_id = s.doctor_id
JOIN public.profiles p ON p.id = s.doctor_id
WHERE s.status = 'available'
  AND d.approval_status = 'approved'
ORDER BY s.slot_date, s.slot_time;

-- =============================================================================
-- STEP 10: Create function to get available time slots for booking UI
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_doctor_id uuid,
  p_date date,
  p_appointment_type text DEFAULT 'consultation'
)
RETURNS TABLE (
  slot_time time,
  is_available boolean,
  consecutive_slots integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_duration integer;
  v_slots_needed integer;
BEGIN
  -- Generate slots if they don't exist
  PERFORM public.generate_doctor_slots(p_doctor_id, p_date, 5);
  
  v_duration := public.get_appointment_duration(p_appointment_type);
  v_slots_needed := CEIL(v_duration::numeric / 5);
  
  RETURN QUERY
  WITH slot_availability AS (
    SELECT 
      s.slot_time as st,
      s.status = 'available' as avail,
      COUNT(*) FILTER (WHERE s2.status = 'available') as consec
    FROM public.appointment_slots s
    LEFT JOIN public.appointment_slots s2 ON 
      s2.doctor_id = s.doctor_id 
      AND s2.slot_date = s.slot_date
      AND s2.slot_time >= s.slot_time
      AND s2.slot_time < s.slot_time + (v_duration || ' minutes')::interval
    WHERE s.doctor_id = p_doctor_id
      AND s.slot_date = p_date
    GROUP BY s.slot_time, s.status
  )
  SELECT 
    sa.st,
    sa.avail AND sa.consec >= v_slots_needed,
    sa.consec::integer
  FROM slot_availability sa
  ORDER BY sa.st;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_appointment_duration TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_doctor_slots TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_appointment TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_emergency_shift TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_missed_appointment TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_update_appointment TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_slots TO authenticated;

-- =============================================================================
-- STEP 11: Generate initial slots for next 14 days for all approved doctors
-- =============================================================================

DO $$
DECLARE
  v_doctor record;
  v_date date;
BEGIN
  FOR v_doctor IN 
    SELECT user_id FROM public.doctors WHERE approval_status = 'approved'
  LOOP
    FOR i IN 1..14 LOOP
      v_date := CURRENT_DATE + i;
      -- Skip weekends
      IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
        PERFORM public.generate_doctor_slots(v_doctor.user_id, v_date, 5);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

