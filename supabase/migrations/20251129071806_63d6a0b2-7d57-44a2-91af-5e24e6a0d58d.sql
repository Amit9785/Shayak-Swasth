-- Add audit logs table for tracking all system actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  resource text NOT NULL,
  resource_id uuid,
  details jsonb,
  timestamp timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins and hospital managers can view audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Hospital managers can view audit logs"
ON public.audit_logs FOR SELECT
USING (has_role(auth.uid(), 'hospital_manager'::app_role));

-- System can insert audit logs (via edge functions)
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- Add record_text table for AI search
CREATE TABLE IF NOT EXISTS public.record_text (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid REFERENCES public.records(id) ON DELETE CASCADE NOT NULL,
  extracted_text text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.record_text ENABLE ROW LEVEL SECURITY;

-- Same access rules as records table
CREATE POLICY "Admins have full access to record text"
ON public.record_text FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Doctors can view all record text"
ON public.record_text FOR SELECT
USING (has_role(auth.uid(), 'doctor'::app_role));

CREATE POLICY "Hospital managers can view all record text"
ON public.record_text FOR SELECT
USING (has_role(auth.uid(), 'hospital_manager'::app_role));

CREATE POLICY "Patients can view their own record text"
ON public.record_text FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.records r
    JOIN public.patients p ON r.patient_id = p.id
    WHERE r.id = record_text.record_id AND p.user_id = auth.uid()
  )
);

-- Add shared_access table for record sharing
CREATE TABLE IF NOT EXISTS public.shared_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid REFERENCES public.records(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_by_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  granted_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(record_id, shared_with_user_id)
);

ALTER TABLE public.shared_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view records shared with them"
ON public.shared_access FOR SELECT
USING (shared_with_user_id = auth.uid());

CREATE POLICY "Patients can share their own records"
ON public.shared_access FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.records r
    JOIN public.patients p ON r.patient_id = p.id
    WHERE r.id = record_id AND p.user_id = auth.uid()
  )
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_record_text_record_id ON public.record_text(record_id);
CREATE INDEX IF NOT EXISTS idx_shared_access_shared_with ON public.shared_access(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_access_record_id ON public.shared_access(record_id);

-- Add RLS policy for patients to insert their own records
CREATE POLICY "Patients can insert their own profile data"
ON public.patients FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Update records RLS to include shared access
CREATE POLICY "Users can view records shared with them"
ON public.records FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shared_access sa
    WHERE sa.record_id = records.id 
    AND sa.shared_with_user_id = auth.uid()
    AND (sa.expires_at IS NULL OR sa.expires_at > now())
  )
);