
-- Create a table to track individual credit purchase batches
CREATE TABLE public.credit_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  credits_total INTEGER NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  plan_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own credit purchases"
  ON public.credit_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credit purchases"
  ON public.credit_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credit purchases"
  ON public.credit_purchases
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX idx_credit_purchases_user_id ON public.credit_purchases (user_id);
CREATE INDEX idx_credit_purchases_expires_at ON public.credit_purchases (expires_at);
