-- ============================================================
-- Apply this on project meplhjxmblcjvvuemzmj (Dashboard > SQL Editor)
-- Creates app_logs with device_id + user_name. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_name TEXT,          -- shown when the user is logged in
  device_id TEXT,          -- shown when the user is NOT logged in (guest)
  log_type TEXT NOT NULL,  -- 'app_open', 'app_close', 'error', etc.
  platform TEXT,           -- 'ios', 'android', 'web'
  device_info JSONB,       -- model, OS version, app version, etc.
  message TEXT,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- In case the table already existed without the new columns:
ALTER TABLE public.app_logs
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS device_id TEXT;

CREATE INDEX IF NOT EXISTS idx_app_logs_user_id   ON public.app_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_device_id ON public.app_logs (device_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_logged_at ON public.app_logs (logged_at);
CREATE INDEX IF NOT EXISTS idx_app_logs_log_type  ON public.app_logs (log_type);

ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert logs" ON public.app_logs;
CREATE POLICY "Allow insert logs"
  ON public.app_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own logs" ON public.app_logs;
CREATE POLICY "Users can view their own logs"
  ON public.app_logs FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);
