-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tier enum type
CREATE TYPE user_tier_enum AS ENUM ('free', 'pro', 'elite', 'institutional');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tier user_tier_enum NOT NULL DEFAULT 'free',
    credits_remaining INTEGER NOT NULL DEFAULT 50,
    credits_monthly_limit INTEGER NOT NULL DEFAULT 50,
    credits_reset_date TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 month'),
    subscription_status VARCHAR(50) DEFAULT 'active',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Watchlist table
CREATE TABLE watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    last_price DECIMAL(10,2),
    price_change DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, symbol)
);

-- Activities table
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    symbol VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(10) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',
    title VARCHAR(255),
    description TEXT,
    importance INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API Usage tracking table for tier limits
CREATE TABLE api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    daily_searches INTEGER DEFAULT 0,
    daily_price_updates INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, usage_date)
);

-- Sentiment History table for tracking historical sentiment data
CREATE TABLE sentiment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    sentiment_score DECIMAL(4,3) NOT NULL,
    sentiment_label VARCHAR(20) NOT NULL, -- 'bullish', 'bearish', 'neutral'
    confidence INTEGER NOT NULL,
    post_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    sources JSONB NOT NULL, -- Array of sources: ['reddit', 'finviz', 'yahoo']
    source_breakdown JSONB, -- Individual scores per source
    price_change DECIMAL(8,4), -- Optional: daily price change for correlation
    volume INTEGER, -- Optional: trading volume
    market_cap BIGINT, -- Optional: market cap at time of sentiment
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ticker, date)
);

-- Create indexes for better query performance
CREATE INDEX idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_events_symbol ON events(symbol);
CREATE INDEX idx_events_scheduled_at ON events(scheduled_at);

-- Sentiment history indexes for efficient queries
CREATE INDEX idx_sentiment_history_ticker ON sentiment_history(ticker);
CREATE INDEX idx_sentiment_history_date ON sentiment_history(date);
CREATE INDEX idx_sentiment_history_ticker_date ON sentiment_history(ticker, date);
CREATE INDEX idx_sentiment_history_score ON sentiment_history(sentiment_score);
CREATE INDEX idx_sentiment_history_confidence ON sentiment_history(confidence);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_watchlist_updated_at
    BEFORE UPDATE ON watchlist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sentiment_history_updated_at
    BEFORE UPDATE ON sentiment_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 