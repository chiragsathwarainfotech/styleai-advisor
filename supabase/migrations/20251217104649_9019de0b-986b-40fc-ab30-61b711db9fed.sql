-- Update scan-images bucket to be private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'scan-images';