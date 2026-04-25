CREATE TABLE IF NOT EXISTS iap_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    app_user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    credits INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, hold
    revenuecat_event JSONB,
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE iap_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own transactions"
ON iap_transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
ON iap_transactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_iap_transactions_user_id ON iap_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_iap_transactions_status ON iap_transactions(status);
CREATE INDEX IF NOT EXISTS idx_iap_transactions_transaction_id ON iap_transactions(transaction_id);
