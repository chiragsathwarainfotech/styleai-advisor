-- Add new columns to user_subscriptions for comprehensive usage tracking
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS free_scans_used integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_chats_used integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_scan_credits integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_chat_credits integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cooldown_until timestamp with time zone DEFAULT NULL;

-- Update the plan_type enum to ensure we have all needed types
-- The existing enum has: 'free', 'basic', 'yearly'

-- Create an index for faster cooldown checks
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_cooldown ON public.user_subscriptions(cooldown_until) WHERE cooldown_until IS NOT NULL;