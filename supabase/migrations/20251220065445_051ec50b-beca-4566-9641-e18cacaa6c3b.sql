-- Create password reset OTPs table
CREATE TABLE public.password_reset_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_password_reset_otps_email ON public.password_reset_otps(email);
CREATE INDEX idx_password_reset_otps_expires ON public.password_reset_otps(expires_at);

-- Enable RLS
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Only allow service role to manage OTPs (edge function uses service role)
CREATE POLICY "Service role can manage OTPs"
ON public.password_reset_otps
FOR ALL
USING (true)
WITH CHECK (true);

-- Create rate limiting table for password reset requests
CREATE TABLE public.password_reset_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for rate limiting lookups
CREATE INDEX idx_password_reset_rate_limits_email ON public.password_reset_rate_limits(email);
CREATE INDEX idx_password_reset_rate_limits_time ON public.password_reset_rate_limits(requested_at);

-- Enable RLS
ALTER TABLE public.password_reset_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow service role to manage rate limits
CREATE POLICY "Service role can manage rate limits"
ON public.password_reset_rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- Function to clean up expired OTPs and old rate limit entries
CREATE OR REPLACE FUNCTION public.cleanup_password_reset_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete expired or used OTPs
  DELETE FROM public.password_reset_otps
  WHERE expires_at < now() OR used = true;
  
  -- Delete rate limit entries older than 1 hour
  DELETE FROM public.password_reset_rate_limits
  WHERE requested_at < now() - interval '1 hour';
END;
$$;