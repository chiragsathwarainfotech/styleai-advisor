-- Create a table to track app open logs
CREATE TABLE public.app_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  log_type TEXT NOT NULL, -- 'app_open', 'app_close', 'error', etc.
  platform TEXT, -- 'ios', 'android', 'web'
  device_info JSONB, -- Device info like OS version, app version, etc.
  message TEXT,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_app_logs_user_id ON public.app_logs (user_id);
CREATE INDEX idx_app_logs_logged_at ON public.app_logs (logged_at);
CREATE INDEX idx_app_logs_log_type ON public.app_logs (log_type);

-- Enable RLS
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert logs (for guest/unauthenticated users too)
CREATE POLICY "Allow insert logs"
  ON public.app_logs
  FOR INSERT
  WITH CHECK (true);

-- Allow users to view their own logs
CREATE POLICY "Users can view their own logs"
  ON public.app_logs
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);
