CREATE TABLE IF NOT EXISTS user_push_tokens (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT PRIMARY KEY,
    platform TEXT NOT NULL, -- ios, android
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own tokens"
ON user_push_tokens FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
