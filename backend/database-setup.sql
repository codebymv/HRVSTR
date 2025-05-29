-- Add user API keys table for per-user API key storage
CREATE TABLE IF NOT EXISTS user_api_keys (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'reddit', 'alpha_vantage', 'finviz', 'sec'
  key_name VARCHAR(50) NOT NULL, -- 'client_id', 'client_secret', 'api_key'
  key_value TEXT, -- encrypted value
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider, key_name)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_provider ON user_api_keys(user_id, provider); 