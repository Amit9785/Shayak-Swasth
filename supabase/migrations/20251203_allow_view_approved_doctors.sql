-- Allow everyone to view approved doctors for appointment booking
-- This is needed so patients can select a doctor when booking

CREATE POLICY "Anyone can view approved doctors"
ON public.doctors FOR SELECT
USING (approval_status = 'approved');

-- Also allow hospital managers to view all doctors (for management)
CREATE POLICY "Managers can view all doctors"
ON public.doctors FOR SELECT
USING (public.has_role(auth.uid(), 'hospital_manager'));

