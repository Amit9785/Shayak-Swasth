-- Phase 1: Add Missing RLS Policy for Hospital Managers
CREATE POLICY "Hospital managers can update records"
ON public.records FOR UPDATE
USING (has_role(auth.uid(), 'hospital_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'hospital_manager'::app_role));

-- Phase 2: Create Notifications Table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  read boolean DEFAULT false,
  related_resource_id uuid,
  related_resource_type text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Phase 3: Create OTP Table for Hospital Manager Actions
CREATE TABLE public.manager_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  otp_code text NOT NULL,
  action_type text NOT NULL,
  resource_id uuid,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.manager_otp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view own OTPs"
ON public.manager_otp FOR SELECT
USING (auth.uid() = manager_id);

CREATE POLICY "Service role can manage OTPs"
ON public.manager_otp FOR ALL
WITH CHECK (true);

-- Phase 4: Enhance Audit Logs Table
ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS user_agent text,
ADD COLUMN IF NOT EXISTS session_id text,
ADD COLUMN IF NOT EXISTS old_value jsonb,
ADD COLUMN IF NOT EXISTS new_value jsonb;

-- Phase 5: Create Notification Triggers
CREATE OR REPLACE FUNCTION public.notify_patient_on_record_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, related_resource_id, related_resource_type)
  SELECT 
    p.user_id,
    'New Medical Record',
    'A new medical record "' || NEW.title || '" has been uploaded.',
    'record_uploaded',
    NEW.id,
    'record'
  FROM public.patients p
  WHERE p.id = NEW.patient_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_patient_on_record_insert
AFTER INSERT ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.notify_patient_on_record_insert();

CREATE OR REPLACE FUNCTION public.notify_patient_on_record_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.title != NEW.title OR OLD.status != NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_resource_id, related_resource_type)
    SELECT 
      p.user_id,
      'Medical Record Updated',
      'Your medical record "' || NEW.title || '" has been updated.',
      'record_updated',
      NEW.id,
      'record'
    FROM public.patients p
    WHERE p.id = NEW.patient_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_patient_on_record_update
AFTER UPDATE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.notify_patient_on_record_update();

CREATE OR REPLACE FUNCTION public.notify_on_record_shared()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, related_resource_id, related_resource_type)
  SELECT 
    NEW.shared_with_user_id,
    'Medical Record Shared',
    'A medical record has been shared with you.',
    'record_shared',
    NEW.record_id,
    'record'
  FROM public.records r
  WHERE r.id = NEW.record_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_on_record_shared
AFTER INSERT ON public.shared_access
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_record_shared();

CREATE OR REPLACE FUNCTION public.notify_doctor_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.approval_status != NEW.approval_status AND NEW.approval_status IN ('approved', 'rejected') THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_resource_id, related_resource_type)
    VALUES (
      NEW.user_id,
      CASE 
        WHEN NEW.approval_status = 'approved' THEN 'Application Approved'
        ELSE 'Application Update'
      END,
      CASE 
        WHEN NEW.approval_status = 'approved' THEN 'Your doctor application has been approved!'
        ELSE 'Your doctor application has been reviewed.'
      END,
      'doctor_approved',
      NEW.id,
      'doctor'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_doctor_on_approval
AFTER UPDATE ON public.doctors
FOR EACH ROW
EXECUTE FUNCTION public.notify_doctor_on_approval();
