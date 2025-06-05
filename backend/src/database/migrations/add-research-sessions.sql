-- Migration: Add research sessions table for component unlock persistence
-- Date: 2024-12-27
-- Purpose: Track active unlock sessions to prevent double-charging users

CREATE TABLE IF NOT EXISTS research_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  component VARCHAR(100) NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'manual_end')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_research_sessions_user_component ON research_sessions(user_id, component);
CREATE INDEX IF NOT EXISTS idx_research_sessions_status_expires ON research_sessions(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_research_sessions_session_id ON research_sessions(session_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_research_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_research_sessions_updated_at
    BEFORE UPDATE ON research_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_research_sessions_updated_at();

-- TIMEZONE FIX: Function to clean up expired sessions using explicit UTC
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
    expired_session RECORD;
    tier_hours INTEGER;
    component_name VARCHAR(255);
BEGIN
    -- First, get all sessions that are about to be expired and log activities
    FOR expired_session IN 
        SELECT user_id, component, metadata, 
               EXTRACT(EPOCH FROM (expires_at - unlocked_at))/3600 as original_duration_hours
        FROM research_sessions 
        WHERE status = 'active' 
        AND expires_at < (NOW() AT TIME ZONE 'UTC')
    LOOP
        -- Extract tier from metadata if available
        tier_hours := COALESCE((expired_session.metadata->>'unlockDurationHours')::INTEGER, 2);
        
        -- Format component name for display
        component_name := CASE 
            WHEN expired_session.component = 'earningsAnalysis' THEN 'Earnings Analysis Research'
            WHEN expired_session.component = 'upcomingEarnings' THEN 'Upcoming Earnings Research'
            WHEN expired_session.component = 'institutionalHoldings' THEN 'Institutional Holdings Research'
            WHEN expired_session.component = 'insiderTrading' THEN 'Insider Trading Research'
            WHEN expired_session.component = 'sentimentAnalysis' THEN 'Sentiment Analysis Research'
            WHEN expired_session.component = 'technicalAnalysis' THEN 'Technical Analysis Research'
            WHEN expired_session.component = 'fundamentalAnalysis' THEN 'Fundamental Analysis Research'
            WHEN expired_session.component = 'marketTrends' THEN 'Market Trends Research'
            WHEN expired_session.component = 'newsAnalysis' THEN 'News Analysis Research'
            WHEN expired_session.component = 'socialSentiment' THEN 'Social Sentiment Research'
            WHEN expired_session.component = 'redditAnalysis' THEN 'Reddit Analysis Research'
            ELSE initcap(replace(expired_session.component, '_', ' ')) || ' Research'
        END;
        
        -- Log the expiration activity
        INSERT INTO activities (user_id, activity_type, title, description, created_at)
        VALUES (
            expired_session.user_id,
            'research_expired',
            'Research Expired',
            component_name || ' expired after ' || tier_hours || ' hour' || 
            CASE WHEN tier_hours = 1 THEN '' ELSE 's' END || ' time limit',
            (NOW() AT TIME ZONE 'UTC')
        );
    END LOOP;
    
    -- Now update the sessions to mark them as expired
    UPDATE research_sessions 
    SET status = 'expired' 
    WHERE status = 'active' 
    AND expires_at < (NOW() AT TIME ZONE 'UTC');
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ language 'plpgsql';

-- Comment the table
COMMENT ON TABLE research_sessions IS 'Tracks active component unlock sessions to prevent double-charging users within reasonable timeframes'; 