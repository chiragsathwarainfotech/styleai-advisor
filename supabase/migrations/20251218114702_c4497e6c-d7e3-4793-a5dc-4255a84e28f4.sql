-- Add consent tracking columns to user_subscriptions
ALTER TABLE public.user_subscriptions
ADD COLUMN terms_accepted boolean NOT NULL DEFAULT false,
ADD COLUMN terms_accepted_timestamp timestamp with time zone DEFAULT NULL;