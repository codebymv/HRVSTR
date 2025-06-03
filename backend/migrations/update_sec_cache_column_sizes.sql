-- Migration to fix VARCHAR column length issues in SEC cache tables
-- Fix for "value too long for type character varying(10)" error

-- Update ticker columns to allow longer values (some tickers/CUSIPs can be longer than 10 chars)
ALTER TABLE user_sec_insider_trades ALTER COLUMN ticker TYPE VARCHAR(20);
ALTER TABLE user_sec_institutional_holdings ALTER COLUMN ticker TYPE VARCHAR(20);

-- Update trade_type column to allow longer values
ALTER TABLE user_sec_insider_trades ALTER COLUMN trade_type TYPE VARCHAR(20);

-- Update time_range column to be safe
ALTER TABLE user_sec_cache ALTER COLUMN time_range TYPE VARCHAR(20);

-- Add comment for tracking
COMMENT ON TABLE user_sec_insider_trades IS 'Updated column sizes to fix VARCHAR(10) length constraints - 2025-06-03';
COMMENT ON TABLE user_sec_institutional_holdings IS 'Updated column sizes to fix VARCHAR(10) length constraints - 2025-06-03'; 