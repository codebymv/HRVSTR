-- Migration: Add User-Specific SEC Data Cache Tables
-- This migration adds tables to cache SEC filings data per user

-- Create enum for data types
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sec_data_type_enum') THEN
        CREATE TYPE sec_data_type_enum AS ENUM ('insider_trades', 'institutional_holdings');
    END IF;
END $$;

-- Create user SEC data cache table
CREATE TABLE IF NOT EXISTS user_sec_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_type sec_data_type_enum NOT NULL,
    time_range VARCHAR(10) NOT NULL, -- '1d', '3d', '1w', '1m', '3m', '6m'
    data_json JSONB NOT NULL, -- The complete API response for frontend
    metadata JSONB, -- Additional info like fetch time, count, etc.
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    credits_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one cache entry per user per data type per time range
    UNIQUE(user_id, data_type, time_range)
);

-- Create individual SEC trade records for detailed tracking
CREATE TABLE IF NOT EXISTS user_sec_insider_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_id UUID NOT NULL REFERENCES user_sec_cache(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    insider_name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    trade_type VARCHAR(20) NOT NULL, -- 'BUY', 'SELL'
    shares BIGINT NOT NULL,
    price DECIMAL(12,4),
    value DECIMAL(15,2),
    filing_date TIMESTAMP WITH TIME ZONE NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE,
    form_type VARCHAR(20),
    raw_data JSONB, -- Complete original data for debugging
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create individual institutional holdings records
CREATE TABLE IF NOT EXISTS user_sec_institutional_holdings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_id UUID NOT NULL REFERENCES user_sec_cache(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    institution_name VARCHAR(255) NOT NULL,
    shares_held BIGINT,
    value_held DECIMAL(15,2),
    percent_change DECIMAL(8,4),
    percentage_ownership DECIMAL(8,4),
    quarterly_change DECIMAL(8,4),
    filing_date TIMESTAMP WITH TIME ZONE NOT NULL,
    quarter_end TIMESTAMP WITH TIME ZONE,
    form_type VARCHAR(20),
    cik VARCHAR(20),
    raw_data JSONB, -- Complete original data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_user_sec_cache_user_type ON user_sec_cache(user_id, data_type);
CREATE INDEX IF NOT EXISTS idx_user_sec_cache_expires ON user_sec_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sec_cache_user_timerange ON user_sec_cache(user_id, time_range);

CREATE INDEX IF NOT EXISTS idx_sec_insider_trades_cache ON user_sec_insider_trades(cache_id);
CREATE INDEX IF NOT EXISTS idx_sec_insider_trades_user ON user_sec_insider_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_sec_insider_trades_ticker ON user_sec_insider_trades(ticker);
CREATE INDEX IF NOT EXISTS idx_sec_insider_trades_filing_date ON user_sec_insider_trades(filing_date);

CREATE INDEX IF NOT EXISTS idx_sec_holdings_cache ON user_sec_institutional_holdings(cache_id);
CREATE INDEX IF NOT EXISTS idx_sec_holdings_user ON user_sec_institutional_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_sec_holdings_ticker ON user_sec_institutional_holdings(ticker);
CREATE INDEX IF NOT EXISTS idx_sec_holdings_filing_date ON user_sec_institutional_holdings(filing_date);

-- Add triggers for updated_at
CREATE TRIGGER update_user_sec_cache_updated_at
    BEFORE UPDATE ON user_sec_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for active (non-expired) SEC cache
CREATE OR REPLACE VIEW active_user_sec_cache AS
SELECT 
    usc.*,
    u.email,
    u.tier,
    CASE 
        WHEN usc.expires_at > CURRENT_TIMESTAMP THEN true 
        ELSE false 
    END as is_active,
    EXTRACT(EPOCH FROM (usc.expires_at - CURRENT_TIMESTAMP)) as seconds_until_expiry
FROM user_sec_cache usc
JOIN users u ON usc.user_id = u.id
WHERE usc.expires_at > CURRENT_TIMESTAMP;

-- Create function to automatically clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_sec_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired cache entries (cascade will handle related records)
    WITH deleted AS (
        DELETE FROM user_sec_cache 
        WHERE expires_at < CURRENT_TIMESTAMP 
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get tier-based expiration time
CREATE OR REPLACE FUNCTION get_sec_cache_expiration(user_tier user_tier_enum, data_type sec_data_type_enum)
RETURNS INTERVAL AS $$
BEGIN
    -- Different expiration times based on tier and data type
    CASE user_tier
        WHEN 'free' THEN
            -- Free tier: 2 hours for insider trades, N/A for institutional (they don't have access)
            CASE data_type
                WHEN 'insider_trades' THEN RETURN INTERVAL '2 hours';
                WHEN 'institutional_holdings' THEN RETURN INTERVAL '0'; -- No access
            END CASE;
        WHEN 'pro' THEN
            -- Pro tier: 8 hours for insider trades, 12 hours for institutional
            CASE data_type
                WHEN 'insider_trades' THEN RETURN INTERVAL '8 hours';
                WHEN 'institutional_holdings' THEN RETURN INTERVAL '12 hours';
            END CASE;
        WHEN 'elite' THEN
            -- Elite tier: 24 hours for both
            RETURN INTERVAL '24 hours';
        WHEN 'institutional' THEN
            -- Institutional tier: 48 hours for both
            RETURN INTERVAL '48 hours';
        ELSE
            -- Default fallback
            RETURN INTERVAL '2 hours';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Create function to determine credits cost for SEC data
CREATE OR REPLACE FUNCTION get_sec_data_credits_cost(user_tier user_tier_enum, data_type sec_data_type_enum, time_range VARCHAR)
RETURNS INTEGER AS $$
BEGIN
    -- Credits cost based on tier, data type, and time range
    CASE user_tier
        WHEN 'free' THEN
            -- Free tier pays credits for insider trades only
            CASE data_type
                WHEN 'insider_trades' THEN
                    CASE time_range
                        WHEN '1d' THEN RETURN 5;
                        WHEN '3d' THEN RETURN 10;
                        WHEN '1w' THEN RETURN 15;
                        WHEN '1m' THEN RETURN 25;
                        WHEN '3m' THEN RETURN 40;
                        WHEN '6m' THEN RETURN 60;
                        ELSE RETURN 15; -- Default
                    END CASE;
                WHEN 'institutional_holdings' THEN RETURN 999999; -- Effectively blocked
            END CASE;
        WHEN 'pro' THEN
            -- Pro tier gets discounted rates
            CASE data_type
                WHEN 'insider_trades' THEN
                    CASE time_range
                        WHEN '1d' THEN RETURN 2;
                        WHEN '3d' THEN RETURN 4;
                        WHEN '1w' THEN RETURN 6;
                        WHEN '1m' THEN RETURN 10;
                        WHEN '3m' THEN RETURN 15;
                        WHEN '6m' THEN RETURN 20;
                        ELSE RETURN 6;
                    END CASE;
                WHEN 'institutional_holdings' THEN
                    CASE time_range
                        WHEN '1d' THEN RETURN 3;
                        WHEN '3d' THEN RETURN 6;
                        WHEN '1w' THEN RETURN 9;
                        WHEN '1m' THEN RETURN 15;
                        WHEN '3m' THEN RETURN 25;
                        WHEN '6m' THEN RETURN 35;
                        ELSE RETURN 9;
                    END CASE;
            END CASE;
        WHEN 'elite', 'institutional' THEN
            -- Elite and institutional tiers get minimal or no credits cost
            RETURN 1; -- Minimal cost for tracking purposes
        ELSE
            -- Default fallback
            RETURN 15;
    END CASE;
END;
$$ LANGUAGE plpgsql; 