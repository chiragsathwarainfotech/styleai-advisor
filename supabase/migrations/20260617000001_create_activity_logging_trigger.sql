-- Create a trigger to log user app sessions on any read operation
-- This fires when authenticated users read from tables

CREATE OR REPLACE FUNCTION public.log_user_activity()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  last_log_time TIMESTAMP WITH TIME ZONE;
BEGIN
  user_id := auth.uid();
  
  -- Only log if user is authenticated
  IF user_id IS NOT NULL THEN
    -- Check if user had activity in the last 30 minutes
    SELECT logged_at INTO last_log_time
    FROM public.app_logs
    WHERE user_id = user_id
      AND log_type = 'app_session_start'
      AND logged_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1;

    -- If no recent activity, create a new session log
    IF last_log_time IS NULL THEN
      INSERT INTO public.app_logs (
        user_id,
        log_type,
        platform,
        device_info,
        message
      ) VALUES (
        user_id,
        'app_session_start',
        'mobile',
        jsonb_build_object(
          'timestamp', NOW()::text,
          'trigger', TG_TABLE_NAME
        ),
        'User accessed: ' || TG_TABLE_NAME
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on key tables (adjust table names as needed)
CREATE TRIGGER log_scan_history_activity
AFTER SELECT ON public.scan_history
FOR EACH ROW EXECUTE FUNCTION public.log_user_activity();

CREATE TRIGGER log_user_subscriptions_activity
AFTER SELECT ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.log_user_activity();

CREATE TRIGGER log_credit_purchases_activity
AFTER SELECT ON public.credit_purchases
FOR EACH ROW EXECUTE FUNCTION public.log_user_activity();
