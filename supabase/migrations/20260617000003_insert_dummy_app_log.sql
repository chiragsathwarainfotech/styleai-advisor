-- Insert one dummy app open log entry for testing
INSERT INTO public.app_logs (
  user_id,
  log_type,
  platform,
  device_info,
  message,
  logged_at,
  created_at
)
VALUES (
  NULL,
  'app_open',
  'android',
  '{"dummy": true, "note": "seed data"}',
  'Dummy app open log entry',
  now(),
  now()
);
