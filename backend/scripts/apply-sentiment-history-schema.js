const { Pool } = require('pg');

const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway'; // Your Railway PUBLIC database URL

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false // Required for connecting to Railway's public endpoint
  }
});

// SQL schema for sentiment_history table
const sentimentHistorySchema = `
-- Create sentiment_history table for historical sentiment tracking
CREATE TABLE IF NOT EXISTS sentiment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    sentiment_score DECIMAL(4,3) NOT NULL, -- -1.000 to 1.000
    sentiment_label VARCHAR(20) NOT NULL,
    confidence DECIMAL(4,3), -- 0.000 to 1.000
    post_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    sources TEXT[], -- Array of data sources used
    source_breakdown JSONB, -- Detailed breakdown by source
    price_change DECIMAL(10,4), -- Optional stock price change
    volume BIGINT, -- Optional trading volume
    market_cap BIGINT, -- Optional market cap
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT sentiment_history_score_range CHECK (sentiment_score >= -1.000 AND sentiment_score <= 1.000),
    CONSTRAINT sentiment_history_confidence_range CHECK (confidence >= 0.000 AND confidence <= 1.000),
    CONSTRAINT sentiment_history_unique_ticker_date UNIQUE(ticker, date)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sentiment_history_ticker ON sentiment_history(ticker);
CREATE INDEX IF NOT EXISTS idx_sentiment_history_date ON sentiment_history(date);
CREATE INDEX IF NOT EXISTS idx_sentiment_history_ticker_date ON sentiment_history(ticker, date);
CREATE INDEX IF NOT EXISTS idx_sentiment_history_created_at ON sentiment_history(created_at);

-- Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
DROP TRIGGER IF EXISTS update_sentiment_history_updated_at ON sentiment_history;
CREATE TRIGGER update_sentiment_history_updated_at
    BEFORE UPDATE ON sentiment_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
`;

async function applySentimentHistorySchema() {
  console.log('🔌 Connecting to database...');
  const client = await pool.connect();
  console.log('✅ Database connected!');

  try {
    console.log('📊 Applying sentiment_history table schema...');
    
    // Execute the schema SQL
    await client.query(sentimentHistorySchema);
    
    console.log('✅ sentiment_history table schema applied successfully!');
    
    // Verify the table exists
    const verifyQuery = `
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'sentiment_history'
      ORDER BY ordinal_position;
    `;
    
    const verifyResult = await client.query(verifyQuery);
    console.log(`✅ Verified: sentiment_history table has ${verifyResult.rows.length} columns`);
    
    // Check indexes
    const indexQuery = `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'sentiment_history'
      ORDER BY indexname;
    `;
    
    const indexResult = await client.query(indexQuery);
    console.log(`✅ Verified: sentiment_history table has ${indexResult.rows.length} indexes`);
    
    console.log('\n🎉 Schema application completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Created sentiment_history table');
    console.log('   - Added proper constraints and indexes');
    console.log('   - Created updated_at trigger');
    console.log('   - Ready for historical sentiment tracking');

  } catch (error) {
    console.error('❌ Error applying sentiment_history schema:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    console.log('🔌 Database connection closed.');
  }
}

applySentimentHistorySchema()
  .then(() => {
    console.log('🚀 Script finished successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }); 