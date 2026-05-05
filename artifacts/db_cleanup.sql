-- 1. Drop redundant tables
DROP TABLE IF EXISTS public.purchase_store_logs;
DROP TABLE IF EXISTS public.upload_rate_limits;

-- 2. Cleanup user_subscriptions table (Remove unwanted fields as requested)
ALTER TABLE public.user_subscriptions 
DROP COLUMN IF EXISTS free_scans_used,
DROP COLUMN IF EXISTS free_chats_used,
DROP COLUMN IF EXISTS paid_scan_credits,
DROP COLUMN IF EXISTS paid_chat_credits;

-- 3. Ensure iap_transactions is robust
-- It already has revenuecat_event (JSONB) to store raw payloads.
