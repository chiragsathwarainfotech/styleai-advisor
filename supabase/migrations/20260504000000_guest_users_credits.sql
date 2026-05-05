-- Guest credit balance lives on guest_users (separate from user_subscriptions
-- which is reserved for fully-signed-up users). Adding columns + an UPDATE
-- RLS policy so the signed-in guest can decrement their own credits.

ALTER TABLE public.guest_users
  ADD COLUMN IF NOT EXISTS credits_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_used INTEGER NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "Users can update their own guest record" ON public.guest_users;
CREATE POLICY "Users can update their own guest record"
ON public.guest_users
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
