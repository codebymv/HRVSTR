-- Migration: Add AI Analysis Cache Tables
-- This migration adds tables to cache AI analysis results per user with session management

-- Create enum for AI analysis types
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_analysis_type_enum') THEN
        CREATE TYPE ai_analysis_type_enum AS ENUM (
            'sentiment_chart_analysis', 
            'ticker_sentiment_analysis', 
            'reddit_post_analysis',
            'combined_sentiment_analysis'
        );
    END IF;
END $$;

-- Create user AI analysis cache table
CREATE TABLE IF NOT EXISTS user_ai_analysis_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    analysis_type ai_analysis_type_enum NOT NULL,
    tickers TEXT[] NOT NULL,
    time_range VARCHAR(10) NOT NULL, -- '1d', '3d', '1w', '1m', '3m', '6m'
    analysis_data JSONB NOT NULL, -- The AI analysis result
    metadata JSONB DEFAULT '{}', -- Additional info like analysis time, confidence, etc.
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    credits_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one cache entry per user per analysis type per tickers per time range
    UNIQUE(user_id, analysis_type, tickers, time_range)
);

-- Create detailed AI analysis records for tracking individual components
CREATE TABLE IF NOT EXISTS user_ai_analysis_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_id UUID NOT NULL REFERENCES user_ai_analysis_cache(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    analysis_type ai_analysis_type_enum NOT NULL,
    analysis_text TEXT NOT NULL, -- The actual AI-generated analysis
    confidence_score DECIMAL(3,2), -- AI confidence (0.00-1.00)
    sentiment_score DECIMAL(4,2), -- Underlying sentiment score
    key_insights TEXT[], -- Array of key bullet points
    risk_factors TEXT[], -- Array of identified risks
    metadata JSONB DEFAULT '{}', -- Model version, tokens used, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_user_ai_analysis_cache_user_id 
ON user_ai_analysis_cache(user_id);

CREATE INDEX IF NOT EXISTS idx_user_ai_analysis_cache_expires_at 
ON user_ai_analysis_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_ai_analysis_cache_session_id 
ON user_ai_analysis_cache(session_id);

CREATE INDEX IF NOT EXISTS idx_user_ai_analysis_cache_user_type_tickers 
ON user_ai_analysis_cache(user_id, analysis_type, tickers);

-- Detail table indexes
CREATE INDEX IF NOT EXISTS idx_user_ai_analysis_details_cache_id 
ON user_ai_analysis_details(cache_id);

CREATE INDEX IF NOT EXISTS idx_user_ai_analysis_details_user_id 
ON user_ai_analysis_details(user_id);

CREATE INDEX IF NOT EXISTS idx_user_ai_analysis_details_ticker 
ON user_ai_analysis_details(ticker);

-- Session-related indexes for AI analysis
CREATE INDEX IF NOT EXISTS idx_research_sessions_ai_component 
ON research_sessions(user_id, component) 
WHERE component IN ('sentimentChartAnalysis', 'sentimentScoreAnalysis', 'redditPostAnalysis');

-- Add cleanup function for expired AI analysis cache
CREATE OR REPLACE FUNCTION cleanup_expired_ai_analysis_cache() 
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired cache entries and their details (CASCADE will handle details)
    DELETE FROM user_ai_analysis_cache 
    WHERE expires_at <= CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % expired AI analysis cache entries', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE user_ai_analysis_cache IS 'Stores cached AI analysis results per user with session management';
COMMENT ON TABLE user_ai_analysis_details IS 'Detailed breakdown of AI analysis for individual tickers';
COMMENT ON COLUMN user_ai_analysis_cache.tickers IS 'Array of ticker symbols analyzed together';
COMMENT ON COLUMN user_ai_analysis_cache.analysis_data IS 'Complete AI analysis result as JSON';
COMMENT ON COLUMN user_ai_analysis_details.analysis_text IS 'Human-readable AI analysis text';
COMMENT ON COLUMN user_ai_analysis_details.key_insights IS 'Array of key insight bullet points'; 