-- Add column for tracking free compare attempts
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS free_compare_attempts_used integer NOT NULL DEFAULT 0;