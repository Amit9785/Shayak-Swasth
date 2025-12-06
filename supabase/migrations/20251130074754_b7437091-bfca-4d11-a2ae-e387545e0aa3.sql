-- Fix security warnings: Set search_path for all trigger functions

CREATE OR REPLACE FUNCTION public.notify_patient_on_record_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.notify_patient_on_record_update()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.notify_on_record_shared()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.notify_doctor_on_approval()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;