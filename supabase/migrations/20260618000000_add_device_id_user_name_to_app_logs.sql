-- Add device identification and user name columns to app_logs.
-- device_id   : persistent/native device identifier (used for guests / not-logged-in users)
-- user_name   : human-readable name resolved at log time (display_name or email) for logged-in users
ALTER TABLE public.app_logs
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS user_name TEXT;

-- Index for looking up logs by device (guest analytics)
CREATE INDEX IF NOT EXISTS idx_app_logs_device_id ON public.app_logs (device_id);
