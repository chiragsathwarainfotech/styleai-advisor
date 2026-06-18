-- Create a function that logs user activity on SELECT queries
CREATE OR REPLACE FUNCTION public.track_user_session()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
BEGIN
  user_id := auth.uid();
  
  -- Only if user is authenticated
  IF user_id IS NOT NULL THEN
    -- Check if we already logged this user in the last 15 minutes (avoid duplicates)
    IF NOT EXISTS (
      SELECT 1 FROM public.app_logs
      WHERE user_id = user_id
        AND log_type = 'app_opened'
        AND logged_at > NOW() - INTERVAL '15 minutes'
    ) THEN
      -- Insert log entry
      INSERT INTO public.app_logs (
        user_id,
        log_type,
        platform,
        device_info,
        message
      ) VALUES (
        user_id,
        'app_opened',
        'mobile',
        jsonb_build_object(
          'timestamp', NOW()::text,
          'trigger_table', TG_TABLE_NAME
        ),
        'User opened app'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT to user_subscriptions (when new user is created)
CREATE TRIGGER app_open_log_on_user_subscriptions
AFTER INSERT ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.track_user_session();

-- Trigger on UPDATE to user_subscriptions (when user checks their subscription on app open)
CREATE TRIGGER app_open_log_on_user_subscriptions_update
AFTER UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.track_user_session();
