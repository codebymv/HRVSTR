-- Migration: Add API Usage tracking table for tier limits
-- Run this to add the api_usage table to an existing database

-- API Usage tracking table for tier limits
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    daily_searches INTEGER DEFAULT 0,
    daily_price_updates INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, usage_date)
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON api_usage(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(usage_date);

-- Add helpful comments
COMMENT ON TABLE api_usage IS 'Tracks daily API usage per user for tier limit enforcement';
COMMENT ON COLUMN api_usage.daily_searches IS 'Number of Alpha Vantage search API calls made today';
COMMENT ON COLUMN api_usage.daily_price_updates IS 'Number of Alpha Vantage price/quote API calls made today';

SELECT 'API Usage table created successfully!' AS status; 