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

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE research_sessions 
    SET status = 'expired' 
    WHERE status = 'active' 
    AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ language 'plpgsql';

-- Comment the table
COMMENT ON TABLE research_sessions IS 'Tracks active component unlock sessions to prevent double-charging users within reasonable timeframes'; 