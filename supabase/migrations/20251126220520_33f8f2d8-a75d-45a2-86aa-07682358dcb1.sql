-- Create storage bucket for medical records
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-records', 'medical-records', false);

-- Allow authenticated users to view files they have access to
CREATE POLICY "Users can view their own medical records"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'medical-records' AND 
  (
    -- Patients can see their own records
    (auth.uid()::text = (storage.foldername(name))[1]) OR
    -- Doctors can see all records
    (SELECT has_role(auth.uid(), 'doctor'::app_role)) OR
    -- Hospital managers can see all records
    (SELECT has_role(auth.uid(), 'hospital_manager'::app_role)) OR
    -- Admins can see all records
    (SELECT has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Allow doctors and hospital managers to upload files
CREATE POLICY "Doctors and managers can upload medical records"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'medical-records' AND
  (
    (SELECT has_role(auth.uid(), 'doctor'::app_role)) OR
    (SELECT has_role(auth.uid(), 'hospital_manager'::app_role))
  )
);

-- Allow doctors and managers to delete files
CREATE POLICY "Doctors and managers can delete medical records"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'medical-records' AND
  (
    (SELECT has_role(auth.uid(), 'doctor'::app_role)) OR
    (SELECT has_role(auth.uid(), 'hospital_manager'::app_role))
  )
);
