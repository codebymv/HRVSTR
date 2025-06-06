const { Pool } = require('pg');
const { getRedditSentiment } = require('../src/controllers/sentimentController');

const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function compareFreshVsCached() {
  console.log('🔍 Comparing Fresh API vs Cached Data Formats...\n');
  
  try {
    // 1. Get fresh API data
    console.log('📡 Fetching FRESH API data...');
    const mockReq = {
      query: { timeRange: '1w' },
      user: { id: 'e0c943d4-da2e-4490-916b-7927e765e83d' }
    };
    
    const mockRes = {
      json: (data) => {
        console.log('✅ Fresh API Response:');
        console.log('- Type:', typeof data);
        console.log('- Is Array:', Array.isArray(data));
        console.log('- Length:', data?.length || 'N/A');
        
        if (data && data.length > 0) {
          console.log('- Sample item structure:', {
            keys: Object.keys(data[0]),
            sampleData: data.slice(0, 2)
          });
        }
        
        return { fresh: data };
      },
      status: () => mockRes,
      send: (msg) => console.log('Fresh API Error:', msg)
    };
    
    // Call the actual sentiment controller
    await getRedditSentiment(mockReq, mockRes);
    
    console.log('\n🗄️ Getting CACHED data from database...');
    
    // 2. Get cached data
    const client = await pool.connect();
    const result = await client.query(`
      SELECT sentiment_data, fetched_at 
      FROM sentiment_research_data 
      WHERE user_id = $1 AND query_type = $2 
      ORDER BY fetched_at DESC 
      LIMIT 1
    `, ['e0c943d4-da2e-4490-916b-7927e765e83d', 'reddit_market']);
    
    if (result.rows.length > 0) {
      const cachedData = result.rows[0].sentiment_data;
      console.log('✅ Cached Data:');
      console.log('- Type:', typeof cachedData);
      console.log('- Is Array:', Array.isArray(cachedData));
      console.log('- Keys:', Object.keys(cachedData));
      
      if (cachedData.timestamps) {
        console.log('- Timestamps length:', cachedData.timestamps.length);
        console.log('- Sample timestamps:', cachedData.timestamps.slice(0, 3));
        console.log('- Sample bullish values:', cachedData.bullish.slice(0, 3));
        console.log('- Sample bearish values:', cachedData.bearish.slice(0, 3));
        console.log('- Sample neutral values:', cachedData.neutral.slice(0, 3));
        console.log('- Sample total values:', cachedData.total.slice(0, 3));
      }
    } else {
      console.log('❌ No cached data found');
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

compareFreshVsCached(); 