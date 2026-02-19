-- Add credit-based system columns to user_subscriptions
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS credits_total INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_used INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_purchased_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS credits_expire_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient expiry checks
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_credits_expire 
ON public.user_subscriptions (credits_expire_at) 
WHERE credits_expire_at IS NOT NULL;