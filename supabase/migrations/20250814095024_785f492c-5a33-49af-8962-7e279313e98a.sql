-- Create function to send email notifications for status changes
CREATE OR REPLACE FUNCTION public.send_status_change_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  email_subject text;
  email_message text;
  status_changed boolean := false;
  role_changed boolean := false;
BEGIN
  -- Check if status changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    status_changed := true;
  END IF;
  
  -- Check if role changed  
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    role_changed := true;
  END IF;
  
  -- Only proceed if status or role changed
  IF NOT (status_changed OR role_changed) THEN
    RETURN NEW;
  END IF;
  
  -- Determine email subject and message based on changes
  IF status_changed THEN
    CASE NEW.status
      WHEN 'approved' THEN
        email_subject := 'Application Approved - Welcome to OAUSTECH Portal';
        email_message := 'Congratulations! Your application has been approved. You can now access the portal with full privileges.';
      WHEN 'rejected' THEN
        email_subject := 'Application Status Update';
        email_message := 'We regret to inform you that your application has not been approved at this time. Please contact administration for more information.';
      WHEN 'suspended' THEN
        email_subject := 'Account Suspended';
        email_message := 'Your account has been temporarily suspended. Please contact administration for assistance.';
      WHEN 'pending' THEN
        email_subject := 'Account Under Review';
        email_message := 'Your account is currently under review. You will be notified once the review is complete.';
      ELSE
        RETURN NEW; -- No email for other status changes
    END CASE;
  ELSIF role_changed THEN
    email_subject := 'Role Updated - OAUSTECH Portal';
    email_message := 'Your role has been updated to: ' || NEW.role || '. Your new permissions are now active.';
  END IF;
  
  -- Send email notification asynchronously using edge function
  PERFORM
    net.http_post(
      url := 'https://apmyxyrrauthjmifpbbp.supabase.co/functions/v1/send-notification-email',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      )::jsonb,
      body := json_build_object(
        'to', NEW.email,
        'subject', email_subject,
        'message', email_message,
        'user_name', NEW.full_name
      )::jsonb
    );
    
  RETURN NEW;
END;
$$;

-- Create trigger for status/role change email notifications
CREATE TRIGGER send_status_change_email_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.send_status_change_email();

-- Also create a function to send welcome email after approval
CREATE OR REPLACE FUNCTION public.send_approval_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only send if status changed from non-approved to approved
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    -- Create an in-app notification
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.id,
      'Welcome to OAUSTECH Portal!',
      'Your account has been approved. Welcome to the portal!',
      'success'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for approval notifications
CREATE TRIGGER send_approval_notification_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.send_approval_notification();