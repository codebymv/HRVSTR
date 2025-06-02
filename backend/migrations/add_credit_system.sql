-- Migration: Add Credit System Tables and Fields
-- This migration adds the premium credit system to HRVSTR

-- First, rename existing fields and add new ones to users table
ALTER TABLE users 
RENAME COLUMN credits_remaining TO credits_used;

ALTER TABLE users 
RENAME COLUMN credits_monthly_limit TO monthly_credits;

-- Update the renamed credits_used to be properly calculated (was remaining, now is used)
UPDATE users 
SET credits_used = GREATEST(0, monthly_credits - credits_used)
WHERE credits_used > 0;

-- Add new credit fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS credits_purchased INTEGER NOT NULL DEFAULT 0;

-- Update existing users based on their tier to set proper monthly_credits values
UPDATE users 
SET monthly_credits = CASE 
    WHEN tier = 'free' THEN 0
    WHEN tier = 'pro' THEN 500
    WHEN tier = 'elite' THEN 2000
    WHEN tier = 'institutional' THEN 10000
    ELSE monthly_credits -- Keep existing value for safety
END;

-- Create credit transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    credits_used INTEGER NOT NULL, -- Can be negative for purchases/refunds
    credits_remaining INTEGER NOT NULL,
    metadata JSONB, -- Store additional transaction details
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create research sessions table
CREATE TABLE IF NOT EXISTS research_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL, -- Client-generated session ID
    symbol VARCHAR(10) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    credits_used INTEGER NOT NULL DEFAULT 0,
    queries_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, paused, completed
    metadata JSONB, -- Store session details
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_research_sessions_user_id ON research_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_research_sessions_session_id ON research_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_research_sessions_status ON research_sessions(status);

-- Add trigger for research_sessions updated_at
CREATE TRIGGER update_research_sessions_updated_at
    BEFORE UPDATE ON research_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for credit balance summary
CREATE OR REPLACE VIEW user_credit_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.tier,
    u.monthly_credits,
    u.credits_used,
    u.credits_purchased,
    (u.monthly_credits + COALESCE(u.credits_purchased, 0)) as total_credits,
    (u.monthly_credits + COALESCE(u.credits_purchased, 0) - u.credits_used) as remaining_credits,
    u.credits_reset_date,
    CASE 
        WHEN u.credits_reset_date < CURRENT_TIMESTAMP THEN true 
        ELSE false 
    END as needs_reset
FROM users u;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON credit_transactions TO your_api_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON research_sessions TO your_api_user;
-- GRANT SELECT ON user_credit_summary TO your_api_user; 