-- Create plan type enum
CREATE TYPE public.plan_type AS ENUM ('free', 'basic', 'yearly');

-- Update user_subscriptions table to add plan tracking
ALTER TABLE public.user_subscriptions 
ADD COLUMN plan_type public.plan_type NOT NULL DEFAULT 'free',
ADD COLUMN uploads_used integer NOT NULL DEFAULT 0,
ADD COLUMN uploads_limit integer NOT NULL DEFAULT 5,
ADD COLUMN conversations_per_upload integer NOT NULL DEFAULT 5;

-- Drop is_premium column as we'll use plan_type instead
ALTER TABLE public.user_subscriptions DROP COLUMN is_premium;

-- Update chat_usage to track per-upload conversations
ALTER TABLE public.chat_usage 
ADD COLUMN current_upload_id text,
ADD COLUMN conversations_this_upload integer NOT NULL DEFAULT 0;

-- Reset conversations when new upload starts
CREATE OR REPLACE FUNCTION public.reset_upload_conversations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NEW.current_upload_id IS DISTINCT FROM OLD.current_upload_id THEN
        NEW.conversations_this_upload := 0;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER reset_conversations_on_new_upload
BEFORE UPDATE ON public.chat_usage
FOR EACH ROW
EXECUTE FUNCTION public.reset_upload_conversations();