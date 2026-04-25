-- Create guest_users table to track guest devices and their associated anonymous accounts
CREATE TABLE IF NOT EXISTS public.guest_users (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guest_users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public insert for guest tracking" 
ON public.guest_users 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view their own guest record" 
ON public.guest_users 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add to real-time if needed (optional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_users;
