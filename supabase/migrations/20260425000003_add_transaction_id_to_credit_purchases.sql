ALTER TABLE IF EXISTS credit_purchases 
ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_credit_purchases_transaction_id ON credit_purchases(transaction_id);
