const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration - using Railway
const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function applySentimentUnifiedCaching() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting sentiment unified caching system migration...');
    console.log('🎯 Goal: Align sentiment with SEC filings and earnings caching architecture');
    
    await client.query('BEGIN');
    
    // 1. Create sentiment data type enum
    console.log('📝 Creating sentiment data type enum...');
    await client.query(`
      DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sentiment_data_type_enum') THEN
              CREATE TYPE sentiment_data_type_enum AS ENUM (
                  'reddit_tickers',
                  'yahoo_tickers', 
                  'finviz_tickers',
                  'reddit_market',
                  'yahoo_market',
                  'finviz_market',
                  'combined_tickers',
                  'aggregated_market'
              );
          END IF;
      END $$;
    `);
    console.log('✅ Sentiment data type enum created');
    
    // 2. Create user sentiment cache table (following SEC/earnings pattern)
    console.log('📊 Creating user_sentiment_cache table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sentiment_cache (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          data_type sentiment_data_type_enum NOT NULL,
          time_range VARCHAR(10) NOT NULL,
          cache_key VARCHAR(255) NOT NULL,
          data_json JSONB NOT NULL,
          metadata JSONB DEFAULT '{}',
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          credits_used INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          
          -- Ensure one cache entry per user per data type per time range per cache key
          UNIQUE(user_id, data_type, time_range, cache_key)
      );
    `);
    console.log('✅ user_sentiment_cache table created');
    
    // 3. Create detailed sentiment data storage tables
    console.log('📊 Creating user_sentiment_tickers table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sentiment_tickers (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          cache_id UUID NOT NULL REFERENCES user_sentiment_cache(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          ticker VARCHAR(20) NOT NULL,
          source VARCHAR(20) NOT NULL, -- 'reddit', 'yahoo', 'finviz'
          sentiment_score DECIMAL(5,4),
          sentiment_label VARCHAR(20), -- 'positive', 'negative', 'neutral'
          confidence DECIMAL(5,4),
          mention_count INTEGER DEFAULT 0,
          post_count INTEGER DEFAULT 0,
          volume INTEGER DEFAULT 0,
          raw_data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ user_sentiment_tickers table created');
    
    console.log('📊 Creating user_sentiment_market_data table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sentiment_market_data (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          cache_id UUID NOT NULL REFERENCES user_sentiment_cache(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          source VARCHAR(20) NOT NULL, -- 'reddit', 'yahoo', 'finviz'
          market_sentiment DECIMAL(5,4),
          sentiment_label VARCHAR(20),
          confidence DECIMAL(5,4),
          data_date DATE NOT NULL,
          metrics JSONB, -- Additional market metrics
          raw_data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ user_sentiment_market_data table created');
    
    // 4. Create indexes for optimal performance (matching SEC/earnings pattern)
    console.log('🔍 Creating performance indexes...');
    
    // Main cache table indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sentiment_cache_user_id 
      ON user_sentiment_cache(user_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sentiment_cache_expires_at 
      ON user_sentiment_cache(expires_at);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sentiment_cache_user_type_range 
      ON user_sentiment_cache(user_id, data_type, time_range);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sentiment_cache_cache_key 
      ON user_sentiment_cache(cache_key);
    `);
    
    // Detail table indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sentiment_tickers_ticker 
      ON user_sentiment_tickers(ticker);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sentiment_tickers_user_id 
      ON user_sentiment_tickers(user_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sentiment_tickers_source 
      ON user_sentiment_tickers(source);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sentiment_market_data_user_id 
      ON user_sentiment_market_data(user_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sentiment_market_data_source_date 
      ON user_sentiment_market_data(source, data_date);
    `);
    
    console.log('✅ Performance indexes created');
    
    // 5. Create updated_at trigger (matching SEC/earnings pattern)
    console.log('🔧 Creating updated_at trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_user_sentiment_cache_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_user_sentiment_cache_updated_at ON user_sentiment_cache;
      CREATE TRIGGER update_user_sentiment_cache_updated_at
          BEFORE UPDATE ON user_sentiment_cache
          FOR EACH ROW
          EXECUTE FUNCTION update_user_sentiment_cache_updated_at();
    `);
    console.log('✅ Updated_at trigger created');
    
    // 6. Create cleanup function (matching SEC/earnings pattern)
    console.log('🧹 Creating cleanup function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION cleanup_expired_sentiment_cache()
      RETURNS INTEGER AS $$
      DECLARE
          expired_count INTEGER;
      BEGIN
          -- Delete expired cache entries
          DELETE FROM user_sentiment_cache 
          WHERE expires_at < CURRENT_TIMESTAMP;
          
          GET DIAGNOSTICS expired_count = ROW_COUNT;
          
          -- Cleanup orphaned detail records
          DELETE FROM user_sentiment_tickers 
          WHERE cache_id NOT IN (SELECT id FROM user_sentiment_cache);
          
          DELETE FROM user_sentiment_market_data 
          WHERE cache_id NOT IN (SELECT id FROM user_sentiment_cache);
          
          RETURN expired_count;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Cleanup function created');
    
    // 7. Create cache key generation function
    console.log('🔧 Creating cache key generation function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION generate_sentiment_cache_key(
        p_data_type sentiment_data_type_enum,
        p_time_range VARCHAR(10),
        p_tickers TEXT[] DEFAULT NULL,
        p_subreddits TEXT[] DEFAULT NULL
      ) RETURNS VARCHAR(255) AS $$
      DECLARE
          cache_key VARCHAR(255);
      BEGIN
          cache_key := p_data_type || '_' || p_time_range;
          
          IF p_tickers IS NOT NULL AND array_length(p_tickers, 1) > 0 THEN
              cache_key := cache_key || '_' || array_to_string(
                  array(SELECT unnest(p_tickers) ORDER BY 1), ','
              );
          END IF;
          
          IF p_subreddits IS NOT NULL AND array_length(p_subreddits, 1) > 0 THEN
              cache_key := cache_key || '_' || array_to_string(
                  array(SELECT unnest(p_subreddits) ORDER BY 1), ','
              );
          END IF;
          
          -- Ensure cache key length limit
          IF length(cache_key) > 255 THEN
              cache_key := substring(cache_key from 1 for 250) || '_hash';
          END IF;
          
          RETURN cache_key;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Cache key generation function created');
    
    // 8. Create cache analytics function (matching SEC/earnings pattern)
    console.log('📊 Creating cache analytics function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION get_sentiment_cache_analytics()
      RETURNS TABLE(
          data_type sentiment_data_type_enum,
          total_entries INTEGER,
          active_entries INTEGER,
          expired_entries INTEGER,
          avg_cache_duration_hours NUMERIC,
          total_records_cached INTEGER
      ) AS $$
      BEGIN
          RETURN QUERY
          SELECT 
              sc.data_type,
              COUNT(*)::INTEGER as total_entries,
              COUNT(*) FILTER (WHERE sc.expires_at > CURRENT_TIMESTAMP)::INTEGER as active_entries,
              COUNT(*) FILTER (WHERE sc.expires_at <= CURRENT_TIMESTAMP)::INTEGER as expired_entries,
              AVG(EXTRACT(EPOCH FROM (sc.expires_at - sc.created_at))/3600)::NUMERIC as avg_cache_duration_hours,
              COALESCE(SUM(CASE 
                  WHEN sc.metadata->>'dataCount' IS NOT NULL 
                  THEN (sc.metadata->>'dataCount')::INTEGER 
                  ELSE 0 
              END), 0)::INTEGER as total_records_cached
          FROM user_sentiment_cache sc
          GROUP BY sc.data_type
          ORDER BY total_entries DESC;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Cache analytics function created');
    
    // 9. Create session analytics function for sentiment components
    console.log('📊 Creating sentiment session analytics function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION get_sentiment_session_analytics()
      RETURNS TABLE(
          component VARCHAR(100),
          total_sessions INTEGER,
          active_sessions INTEGER,
          avg_credits_per_session NUMERIC,
          avg_session_duration_hours NUMERIC
      ) AS $$
      BEGIN
          RETURN QUERY
          SELECT 
              rs.component,
              COUNT(*)::INTEGER as total_sessions,
              COUNT(*) FILTER (WHERE rs.status = 'active' AND rs.expires_at > CURRENT_TIMESTAMP)::INTEGER as active_sessions,
              AVG(rs.credits_used)::NUMERIC as avg_credits_per_session,
              AVG(EXTRACT(EPOCH FROM (rs.expires_at - rs.unlocked_at))/3600)::NUMERIC as avg_session_duration_hours
          FROM research_sessions rs
          WHERE rs.component IN ('sentimentChart', 'sentimentScores', 'sentimentReddit')
          GROUP BY rs.component
          ORDER BY total_sessions DESC;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Sentiment session analytics function created');
    
    // 10. Add table comments for documentation
    await client.query(`
      COMMENT ON TABLE user_sentiment_cache IS 'User-specific sentiment data cache implementing unified three-tier architecture (session -> cache -> fresh)';
    `);
    
    await client.query(`
      COMMENT ON TABLE user_sentiment_tickers IS 'Detailed sentiment data for individual tickers from various sources';
    `);
    
    await client.query(`
      COMMENT ON TABLE user_sentiment_market_data IS 'Detailed market-wide sentiment data from various sources';
    `);
    
    await client.query(`
      COMMENT ON COLUMN user_sentiment_cache.data_type IS 'Type of sentiment data (reddit_tickers, yahoo_tickers, etc.)';
    `);
    
    await client.query(`
      COMMENT ON COLUMN user_sentiment_cache.cache_key IS 'Generated cache key incorporating tickers, subreddits, and other parameters';
    `);
    
    await client.query(`
      COMMENT ON COLUMN user_sentiment_cache.data_json IS 'Complete API response data for frontend consumption';
    `);
    
    await client.query(`
      COMMENT ON COLUMN user_sentiment_cache.metadata IS 'Cache metadata: fetch time, count, performance stats, etc.';
    `);
    
    // 11. Test sample data creation and cache key generation
    console.log('🧪 Testing cache key generation...');
    const testCacheKey = await client.query(`
      SELECT generate_sentiment_cache_key(
        'reddit_tickers'::sentiment_data_type_enum,
        '1w',
        ARRAY['AAPL', 'MSFT', 'TSLA'],
        ARRAY['wallstreetbets', 'stocks']
      ) as test_key
    `);
    console.log(`✅ Test cache key generated: ${testCacheKey.rows[0].test_key}`);
    
    // 12. Create sample cache entry for testing (if users exist)
    console.log('📝 Creating sample cache data for testing...');
    const testUser = await client.query('SELECT id FROM users LIMIT 1');
    
    if (testUser.rows.length > 0) {
      const userId = testUser.rows[0].id;
      const sampleCacheKey = testCacheKey.rows[0].test_key;
      
      // Create sample cache entry
      await client.query(`
        INSERT INTO user_sentiment_cache (
          user_id, 
          data_type, 
          time_range, 
          cache_key, 
          data_json, 
          metadata,
          expires_at,
          credits_used
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, data_type, time_range, cache_key) DO NOTHING
      `, [
        userId,
        'reddit_tickers',
        '1w',
        sampleCacheKey,
        JSON.stringify([
          {
            ticker: 'AAPL',
            sentiment: 0.75,
            source: 'reddit',
            mentions: 150,
            confidence: 0.89
          },
          {
            ticker: 'MSFT',
            sentiment: 0.68,
            source: 'reddit', 
            mentions: 85,
            confidence: 0.76
          }
        ]),
        JSON.stringify({
          dataCount: 2,
          fetchDuration: '1250ms',
          tier: 'pro',
          test_data: true
        }),
        new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        5
      ]);
      
      console.log('✅ Sample cache data created');
    }
    
    // 13. Test cleanup function
    console.log('🧪 Testing cleanup function...');
    const cleanupResult = await client.query('SELECT cleanup_expired_sentiment_cache()');
    const expiredCount = cleanupResult.rows[0].cleanup_expired_sentiment_cache;
    console.log(`✅ Cleanup function test: ${expiredCount} expired cache entries cleaned`);
    
    // 14. Verify table structures
    console.log('🔍 Verifying table structures...');
    
    const cacheTableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_sentiment_cache' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 user_sentiment_cache structure:');
    cacheTableInfo.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
    });
    
    // 15. Display analytics
    console.log('📊 Running cache analytics...');
    const analytics = await client.query('SELECT * FROM get_sentiment_cache_analytics()');
    
    if (analytics.rows.length > 0) {
      console.log('📈 Sentiment Cache Analytics:');
      analytics.rows.forEach(row => {
        console.log(`   ${row.data_type}: ${row.total_entries} total, ${row.active_entries} active, ${row.expired_entries} expired`);
      });
    }
    
    const sessionAnalytics = await client.query('SELECT * FROM get_sentiment_session_analytics()');
    
    if (sessionAnalytics.rows.length > 0) {
      console.log('📈 Sentiment Session Analytics:');
      sessionAnalytics.rows.forEach(row => {
        console.log(`   ${row.component}: ${row.total_sessions} sessions, ${row.active_sessions} active, avg ${parseFloat(row.avg_credits_per_session || 0).toFixed(1)} credits`);
      });
    }
    
    await client.query('COMMIT');
    
    console.log('🎉 Sentiment unified caching system migration completed successfully!');
    console.log('');
    console.log('📋 Migration Summary:');
    console.log('   ✅ Created sentiment_data_type_enum');
    console.log('   ✅ Created user_sentiment_cache table (main cache)');
    console.log('   ✅ Created user_sentiment_tickers table (detailed ticker data)');
    console.log('   ✅ Created user_sentiment_market_data table (detailed market data)');
    console.log('   ✅ Created optimized indexes for performance');
    console.log('   ✅ Created updated_at triggers');
    console.log('   ✅ Created cleanup functions');
    console.log('   ✅ Created cache key generation function');
    console.log('   ✅ Created analytics functions');
    console.log('   ✅ Added comprehensive documentation');
    console.log('   ✅ Created sample test data');
    console.log('');
    console.log('🚀 Sentiment system now ready for unified three-tier caching architecture!');
    console.log('🔄 Next steps: Implement userSentimentCacheService.js and update frontend hooks');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during sentiment caching migration:', error);
    throw error;
  } finally {
    client.release();
    pool.end();
    console.log('🔒 Database connection closed.');
  }
}

applySentimentUnifiedCaching()
  .then(() => {
    console.log('✅ Migration script completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  }); 