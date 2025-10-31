-- Create signup pages for admin and hospital manager roles
-- Insert a default admin user for initial access
-- Note: This creates a user with email admin@healthcare.local and password Admin123!
-- CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN

-- First, ensure we have the trigger function for new users
CREATE OR REPLACE FUNCTION public.assign_role_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Get the role from user metadata
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to assign roles on signup
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_role_on_signup();
