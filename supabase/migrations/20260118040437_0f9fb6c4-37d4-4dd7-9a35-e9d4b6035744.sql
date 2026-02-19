-- Fix RLS policies for upload_rate_limits - restrict to service role only
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.upload_rate_limits;

CREATE POLICY "Service role only access"
ON public.upload_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix RLS policies for password_reset_rate_limits - restrict to service role only  
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.password_reset_rate_limits;

CREATE POLICY "Service role only access"
ON public.password_reset_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix RLS policies for password_reset_otps - restrict to service role only
DROP POLICY IF EXISTS "Service role can manage OTPs" ON public.password_reset_otps;

CREATE POLICY "Service role only access"
ON public.password_reset_otps
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);