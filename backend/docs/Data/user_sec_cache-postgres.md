# SEC User-Specific Cache Tables - PostgreSQL Schema

## Overview

The SEC user-specific caching system uses three PostgreSQL tables to store cached SEC data per user, replacing the previous localStorage approach. This provides cross-device access, tier-based expiration, and credit integration.

## Tables

### 1. `user_sec_cache`

**Purpose**: Main cache table storing metadata and small data payloads for SEC requests.

```sql
CREATE TABLE user_sec_cache (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  cache_key VARCHAR(255) NOT NULL,
  data_type VARCHAR(50) NOT NULL,
  time_range VARCHAR(50) NOT NULL,
  data JSONB,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tier VARCHAR(20) DEFAULT 'free',
  UNIQUE(user_id, cache_key)
);

CREATE INDEX idx_user_sec_cache_user_id ON user_sec_cache(user_id);
CREATE INDEX idx_user_sec_cache_expires_at ON user_sec_cache(expires_at);
CREATE INDEX idx_user_sec_cache_data_type ON user_sec_cache(data_type);
```

**Columns**:
- `id`: Primary key
- `user_id`: User identifier (UUID format)
- `cache_key`: Composite key format: `{data_type}_{time_range}_{tier}_{timestamp}`
- `data_type`: Type of SEC data (`insider_trades`, `institutional_holdings`)
- `time_range`: Time range filter (`1w`, `1m`, `3m`, `6m`)
- `data`: JSONB payload for small datasets
- `expires_at`: Cache expiration timestamp (tier-based)
- `created_at`: Creation timestamp
- `tier`: User tier when cache was created

**Cache Key Format**: `insider_trades_1m_pro_1748945581985`

### 2. `user_sec_insider_trades`

**Purpose**: Dedicated table for insider trading data with optimized structure.

```sql
CREATE TABLE user_sec_insider_trades (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  cache_key VARCHAR(255) NOT NULL,
  ticker VARCHAR(50),
  insider_name VARCHAR(255),
  title VARCHAR(200),
  trade_type VARCHAR(50),
  shares BIGINT,
  price DECIMAL(10,2),
  value DECIMAL(15,2),
  filing_date TIMESTAMP,
  transaction_date TIMESTAMP,
  form_type VARCHAR(20),
  url TEXT,
  time_range VARCHAR(50),
  tier VARCHAR(20) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_user_sec_insider_trades_user_id ON user_sec_insider_trades(user_id);
CREATE INDEX idx_user_sec_insider_trades_cache_key ON user_sec_insider_trades(cache_key);
CREATE INDEX idx_user_sec_insider_trades_ticker ON user_sec_insider_trades(ticker);
CREATE INDEX idx_user_sec_insider_trades_expires_at ON user_sec_insider_trades(expires_at);
CREATE INDEX idx_user_sec_insider_trades_filing_date ON user_sec_insider_trades(filing_date);
```

**Columns**:
- `id`: Primary key
- `user_id`: User identifier
- `cache_key`: Links to main cache entry
- `ticker`: Stock ticker symbol (increased to VARCHAR(50))
- `insider_name`: Name of insider (increased to VARCHAR(255))
- `title`: Insider's title/role
- `trade_type`: Type of trade (`BUY`, `SELL`, etc., increased to VARCHAR(50))
- `shares`: Number of shares traded
- `price`: Price per share
- `value`: Total transaction value
- `filing_date`: SEC filing date
- `transaction_date`: Actual transaction date
- `form_type`: SEC form type (e.g., "4")
- `url`: Link to SEC filing
- `time_range`: Associated time range filter
- `tier`: User tier
- `created_at`: Creation timestamp
- `expires_at`: Cache expiration

### 3. `user_sec_institutional_holdings`

**Purpose**: Dedicated table for institutional holdings data (13F filings).

```sql
CREATE TABLE user_sec_institutional_holdings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  cache_key VARCHAR(255) NOT NULL,
  cik VARCHAR(20),
  ticker VARCHAR(50),
  institution_name VARCHAR(255),
  shares_held BIGINT,
  value_held DECIMAL(15,2),
  total_shares_held BIGINT,
  total_value_held DECIMAL(15,2),
  filing_date TIMESTAMP,
  form_type VARCHAR(20),
  url TEXT,
  time_range VARCHAR(50),
  tier VARCHAR(20) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_user_sec_institutional_holdings_user_id ON user_sec_institutional_holdings(user_id);
CREATE INDEX idx_user_sec_institutional_holdings_cache_key ON user_sec_institutional_holdings(cache_key);
CREATE INDEX idx_user_sec_institutional_holdings_ticker ON user_sec_institutional_holdings(ticker);
CREATE INDEX idx_user_sec_institutional_holdings_institution ON user_sec_institutional_holdings(institution_name);
CREATE INDEX idx_user_sec_institutional_holdings_expires_at ON user_sec_institutional_holdings(expires_at);
CREATE INDEX idx_user_sec_institutional_holdings_filing_date ON user_sec_institutional_holdings(filing_date);
```

**Columns**:
- `id`: Primary key
- `user_id`: User identifier
- `cache_key`: Links to main cache entry
- `cik`: Central Index Key (SEC identifier)
- `ticker`: Stock ticker symbol (increased to VARCHAR(50))
- `institution_name`: Name of institution (increased to VARCHAR(255))
- `shares_held`: Number of shares held
- `value_held`: Value of holdings
- `total_shares_held`: Total shares across all holdings
- `total_value_held`: Total value across all holdings
- `filing_date`: 13F filing date
- `form_type`: SEC form type (e.g., "13F")
- `url`: Link to SEC filing
- `time_range`: Associated time range filter
- `tier`: User tier
- `created_at`: Creation timestamp
- `expires_at`: Cache expiration

## Active Cache View

```sql
CREATE OR REPLACE VIEW active_user_sec_cache AS
SELECT 
  user_id,
  cache_key,
  data_type,
  time_range,
  created_at,
  expires_at,
  EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)) as seconds_until_expiry
FROM user_sec_cache 
WHERE expires_at > CURRENT_TIMESTAMP;
```

## Tier-Based Expiration

The cache expiration is based on user tier:

- **Free**: 1 hour (3600 seconds)
- **Pro**: 6 hours (21600 seconds)
- **Elite**: 12 hours (43200 seconds)
- **Institutional**: 24 hours (86400 seconds)

## Data Flow

1. **Cache Check**: Query `user_sec_cache` for valid entry
2. **Data Retrieval**: If cache hit, fetch data from appropriate specialized table
3. **Cache Miss**: Fetch from SEC API, store in both main cache and specialized table
4. **Expiration**: Automatic cleanup via cron job or manual cleanup queries

## Schema Evolution

### Version 1.0 → 1.1 (Schema Fixes)
- Increased `ticker` from VARCHAR(10) → VARCHAR(50)
- Increased `trade_type` from VARCHAR(10) → VARCHAR(50) 
- Increased `time_range` from VARCHAR(10) → VARCHAR(50)
- Increased `insider_name` from VARCHAR(20) → VARCHAR(255)
- Increased `institution_name` from VARCHAR(20) → VARCHAR(255)
- Fixed view creation removing non-existent `tier` column reference

### Migration Applied
```sql
-- Fix schema constraints
ALTER TABLE user_sec_insider_trades 
  ALTER COLUMN ticker TYPE VARCHAR(50),
  ALTER COLUMN trade_type TYPE VARCHAR(50),
  ALTER COLUMN insider_name TYPE VARCHAR(255);

ALTER TABLE user_sec_institutional_holdings 
  ALTER COLUMN ticker TYPE VARCHAR(50),
  ALTER COLUMN institution_name TYPE VARCHAR(255);

ALTER TABLE user_sec_cache 
  ALTER COLUMN time_range TYPE VARCHAR(50);

-- Recreate view without tier column
DROP VIEW IF EXISTS active_user_sec_cache;
CREATE OR REPLACE VIEW active_user_sec_cache AS
SELECT 
  user_id,
  cache_key,
  data_type,
  time_range,
  created_at,
  expires_at,
  EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)) as seconds_until_expiry
FROM user_sec_cache 
WHERE expires_at > CURRENT_TIMESTAMP;
```

## Cleanup Operations

### Expired Cache Cleanup
```sql
-- Delete expired cache entries
DELETE FROM user_sec_cache WHERE expires_at < CURRENT_TIMESTAMP;
DELETE FROM user_sec_insider_trades WHERE expires_at < CURRENT_TIMESTAMP;
DELETE FROM user_sec_institutional_holdings WHERE expires_at < CURRENT_TIMESTAMP;
```

### User-Specific Cache Clear
```sql
-- Clear all cache for a specific user
DELETE FROM user_sec_cache WHERE user_id = $1;
DELETE FROM user_sec_insider_trades WHERE user_id = $1;
DELETE FROM user_sec_institutional_holdings WHERE user_id = $1;
```

## Performance Considerations

- **Indexes**: Optimized for user_id, cache_key, expires_at, and ticker lookups
- **JSONB**: Main cache table uses JSONB for flexible small data storage
- **Partitioning**: Consider partitioning by user_id for large datasets
- **Cleanup**: Regular cleanup of expired entries prevents table bloat

## Security

- **User Isolation**: All queries include user_id for data isolation
- **Cache Keys**: Include tier information to prevent tier escalation
- **Expiration**: Automatic expiration prevents stale data access
- **Validation**: Backend validates user ownership before cache access 