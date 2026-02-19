-- Create table to track upload timestamps for rate limiting
CREATE TABLE public.upload_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying by user and time
CREATE INDEX idx_upload_rate_limits_user_time ON public.upload_rate_limits (user_id, uploaded_at DESC);

-- Enable RLS
ALTER TABLE public.upload_rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role can manage all records (for edge function)
CREATE POLICY "Service role can manage rate limits"
ON public.upload_rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- Create function to clean up old rate limit records (older than 2 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.upload_rate_limits
  WHERE uploaded_at < now() - interval '2 minutes';
END;
$$;