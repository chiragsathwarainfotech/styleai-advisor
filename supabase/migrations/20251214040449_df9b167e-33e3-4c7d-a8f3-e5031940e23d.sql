
-- Create scan_history table
CREATE TABLE public.scan_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  analysis_text TEXT NOT NULL,
  style_score INTEGER CHECK (style_score >= 0 AND style_score <= 100),
  outfit_category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own scan history"
ON public.scan_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scans"
ON public.scan_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scans"
ON public.scan_history
FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_scan_history_user_created ON public.scan_history(user_id, created_at DESC);

-- Create storage bucket for scan images
INSERT INTO storage.buckets (id, name, public) VALUES ('scan-images', 'scan-images', true);

-- Storage policies
CREATE POLICY "Users can upload their own scan images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own scan images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own scan images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view scan images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'scan-images');
