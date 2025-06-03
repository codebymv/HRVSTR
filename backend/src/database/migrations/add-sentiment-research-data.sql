-- Migration: Add sentiment research data persistence table
-- Date: 2025-06-02 
-- Purpose: Store fetched sentiment data to prevent unnecessary refetching within active sessions

CREATE TABLE IF NOT EXISTS sentiment_research_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Link to session and user
  session_id VARCHAR(255) NOT NULL REFERENCES research_sessions(session_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Query parameters (for cache key generation)
  query_type VARCHAR(50) NOT NULL CHECK (query_type IN (
    'reddit_market',      -- /api/sentiment/reddit/market
    'yahoo_market',       -- /api/sentiment/yahoo/market  
    'finviz_tickers',     -- /api/finviz/ticker-sentiment
    'yahoo_tickers',      -- /api/sentiment/yahoo/tickers
    'finviz_market',      -- /api/finviz/market-sentiment
    'reddit_tickers',     -- /api/sentiment/reddit/tickers
    'combined_tickers'    -- /api/sentiment/combined/tickers
  )),
  
  -- Query parameters for cache key
  tickers TEXT[], -- ['AAPL', 'MSFT', 'NVDA', 'TSLA'] or ['SPY', 'QQQ', 'IWM'] 
  time_range VARCHAR(10) DEFAULT '1w', -- '1d', '1w', '1m', '3m'
  subreddits TEXT[], -- ['wallstreetbets', 'stocks', 'investing'] for reddit calls
  
  -- Results data (matching your SentimentData interface)
  sentiment_data JSONB NOT NULL, -- Array of SentimentData objects
  
  -- Metadata from API responses
  api_metadata JSONB DEFAULT '{}', -- Credits used, performance stats, etc.
  
  -- Timing and expiration
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  
  -- Performance tracking
  fetch_duration_ms INTEGER,
  credits_consumed INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sentiment_research_session ON sentiment_research_data(session_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_research_user ON sentiment_research_data(user_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_research_query ON sentiment_research_data(query_type, tickers, time_range);
CREATE INDEX IF NOT EXISTS idx_sentiment_research_expires ON sentiment_research_data(expires_at);

-- Composite index for exact cache lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_sentiment_research_cache_key 
ON sentiment_research_data(session_id, query_type, tickers, time_range, subreddits);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_sentiment_research_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sentiment_research_data_updated_at
    BEFORE UPDATE ON sentiment_research_data
    FOR EACH ROW
    EXECUTE FUNCTION update_sentiment_research_data_updated_at();

-- Function to generate cache key for lookups
CREATE OR REPLACE FUNCTION generate_sentiment_cache_key(
  p_query_type VARCHAR(50),
  p_tickers TEXT[],
  p_time_range VARCHAR(10) DEFAULT '1w',
  p_subreddits TEXT[] DEFAULT NULL
) RETURNS TEXT AS $$
BEGIN
  RETURN p_query_type || '_' || 
         array_to_string(array(SELECT unnest(p_tickers) ORDER BY 1), ',') || '_' ||
         COALESCE(p_time_range, '1w') || '_' ||
         COALESCE(array_to_string(array(SELECT unnest(p_subreddits) ORDER BY 1), ','), '');
END;
$$ language 'plpgsql';

-- Enhanced function to clean up expired data and data from expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sentiment_data()
RETURNS TABLE(
  expired_data_count INTEGER,
  expired_session_data_count INTEGER,
  total_cleaned INTEGER
) AS $$
DECLARE
    expired_data_count INTEGER := 0;
    expired_session_data_count INTEGER := 0;
    total_cleaned INTEGER := 0;
BEGIN
    -- Clean up data that has passed its data freshness expiry
    DELETE FROM sentiment_research_data 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS expired_data_count = ROW_COUNT;
    
    -- Clean up data from sessions that have expired (even if data freshness hasn't expired)
    DELETE FROM sentiment_research_data 
    WHERE session_id IN (
      SELECT session_id 
      FROM research_sessions 
      WHERE expires_at < CURRENT_TIMESTAMP 
        OR status != 'active'
    );
    
    GET DIAGNOSTICS expired_session_data_count = ROW_COUNT;
    
    total_cleaned := expired_data_count + expired_session_data_count;
    
    RETURN QUERY SELECT expired_data_count, expired_session_data_count, total_cleaned;
END;
$$ language 'plpgsql';

-- Function to check cache statistics for monitoring
CREATE OR REPLACE FUNCTION get_sentiment_cache_stats()
RETURNS TABLE(
  total_cached_records INTEGER,
  active_sessions INTEGER,
  expired_records INTEGER,
  total_data_size_mb NUMERIC,
  oldest_cache_age_hours NUMERIC,
  newest_cache_age_minutes NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
      (SELECT COUNT(*)::INTEGER FROM sentiment_research_data) as total_cached_records,
      (SELECT COUNT(*)::INTEGER FROM research_sessions WHERE status = 'active' AND expires_at > CURRENT_TIMESTAMP) as active_sessions,
      (SELECT COUNT(*)::INTEGER FROM sentiment_research_data WHERE expires_at < CURRENT_TIMESTAMP) as expired_records,
      (SELECT ROUND((pg_total_relation_size('sentiment_research_data') / 1024.0 / 1024.0)::NUMERIC, 2)) as total_data_size_mb,
      (SELECT ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MIN(fetched_at)))/3600::NUMERIC, 2) FROM sentiment_research_data) as oldest_cache_age_hours,
      (SELECT ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MAX(fetched_at)))/60::NUMERIC, 2) FROM sentiment_research_data) as newest_cache_age_minutes;
END;
$$ language 'plpgsql';

-- Comments for documentation
COMMENT ON TABLE sentiment_research_data IS 'Stores fetched sentiment analysis results to prevent unnecessary API refetching within active research sessions';
COMMENT ON COLUMN sentiment_research_data.query_type IS 'Type of sentiment query - maps to specific API endpoints';
COMMENT ON COLUMN sentiment_research_data.tickers IS 'Array of stock tickers for the query - used for cache key generation';
COMMENT ON COLUMN sentiment_research_data.time_range IS 'Time range for historical sentiment data (1d, 1w, 1m, 3m)';
COMMENT ON COLUMN sentiment_research_data.sentiment_data IS 'JSON array of SentimentData objects returned from API';
COMMENT ON COLUMN sentiment_research_data.api_metadata IS 'Additional metadata from API responses (credits, performance, etc.)';
COMMENT ON COLUMN sentiment_research_data.expires_at IS 'Cache expiration time - respects BOTH session duration AND data freshness limits'; 