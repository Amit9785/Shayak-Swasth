-- Allow doctors to view all profiles
CREATE POLICY "Doctors can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'doctor'::app_role));

-- Allow hospital managers to view all profiles
CREATE POLICY "Hospital managers can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'hospital_manager'::app_role));

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
