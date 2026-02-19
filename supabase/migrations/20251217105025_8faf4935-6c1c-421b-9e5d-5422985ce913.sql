-- Add save_scan_history preference to user_subscriptions table
ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS save_scan_history boolean NOT NULL DEFAULT true;