const cron = require('node-cron');
const { getAggregatedSentiment } = require('../services/aggregatedSentimentService');
const { saveDailySentiment } = require('../services/historicalSentimentService');

// Common ticker symbols to track daily
const DEFAULT_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'AMD', 'INTC',
  'CRM', 'ADBE', 'PYPL', 'SHOP', 'SQ', 'ROKU', 'ZM', 'DOCU', 'SNOW', 'PLTR',
  'UBER', 'LYFT', 'COIN', 'RBLX', 'RIVN', 'LCID', 'F', 'GM', 'DIS', 'WMT'
];

/**
 * Run daily sentiment aggregation for a list of tickers
 * @param {Array<string>} tickers - Array of ticker symbols to process
 * @returns {Promise<Object>} Aggregation results
 */
async function runDailySentimentAggregation(tickers = DEFAULT_TICKERS) {
  const startTime = Date.now();
  const results = {
    success: [],
    errors: [],
    totalProcessed: 0,
    totalErrors: 0,
    executionTime: 0
  };

  console.log(`🤖 Starting daily sentiment aggregation for ${tickers.length} tickers...`);

  try {
    // Process tickers in smaller batches to avoid overwhelming APIs
    const batchSize = 5;
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      console.log(`🤖 Processing batch ${Math.floor(i/batchSize) + 1}: ${batch.join(', ')}`);

      // Process each ticker in the batch
      const batchPromises = batch.map(async (ticker) => {
        try {
          // Get aggregated sentiment for the ticker
          const aggregatedData = await getAggregatedSentiment(ticker, '1d', ['reddit', 'finviz', 'yahoo']);
          
          if (aggregatedData.aggregatedSentimentData && aggregatedData.aggregatedSentimentData.length > 0) {
            const sentimentData = aggregatedData.aggregatedSentimentData[0]; // First (and should be only) result
            
            // Prepare source breakdown
            const sourceBreakdown = {};
            if (aggregatedData.sourceData) {
              Object.entries(aggregatedData.sourceData).forEach(([source, data]) => {
                if (data.sentimentData && data.sentimentData.length > 0) {
                  const sourceItem = data.sentimentData.find(item => item.ticker === ticker);
                  if (sourceItem) {
                    sourceBreakdown[source] = {
                      score: sourceItem.score,
                      confidence: sourceItem.confidence || 50,
                      postCount: sourceItem.postCount || 0,
                      commentCount: sourceItem.commentCount || 0
                    };
                  }
                }
              });
            }

            // Save to historical sentiment
            await saveDailySentiment({
              ticker: sentimentData.ticker,
              score: sentimentData.score,
              sentiment: sentimentData.sentiment,
              confidence: sentimentData.confidence,
              postCount: sentimentData.postCount,
              commentCount: sentimentData.commentCount,
              sources: sentimentData.sources ? sentimentData.sources.split(',') : Object.keys(sourceBreakdown),
              sourceBreakdown: sourceBreakdown
            });

            results.success.push({
              ticker,
              score: sentimentData.score,
              sentiment: sentimentData.sentiment,
              sources: Object.keys(sourceBreakdown)
            });
          } else {
            console.warn(`⚠️ No sentiment data found for ${ticker}`);
            results.errors.push({
              ticker,
              error: 'No sentiment data available'
            });
          }
        } catch (error) {
          console.error(`❌ Error processing ${ticker}:`, error.message);
          results.errors.push({
            ticker,
            error: error.message
          });
        }
      });

      // Wait for batch to complete
      await Promise.allSettled(batchPromises);
      
      // Small delay between batches to be respectful to APIs
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    results.totalProcessed = results.success.length;
    results.totalErrors = results.errors.length;
    results.executionTime = Date.now() - startTime;

    console.log(`✅ Daily sentiment aggregation completed: ${results.totalProcessed} successful, ${results.totalErrors} errors in ${results.executionTime}ms`);
    
    return results;

  } catch (error) {
    console.error('❌ Fatal error in daily sentiment aggregation:', error);
    results.executionTime = Date.now() - startTime;
    throw error;
  }
}

/**
 * Initialize and start the daily sentiment aggregation scheduler
 */
function initializeDailySentimentJob() {
  // Run at 6:00 AM UTC every day
  const cronExpression = '0 6 * * *';
  
  console.log(`🕐 Scheduling daily sentiment aggregation: ${cronExpression} (6:00 AM UTC daily)`);
  
  const task = cron.schedule(cronExpression, async () => {
    try {
      console.log(`🤖 [${new Date().toISOString()}] Starting scheduled daily sentiment aggregation...`);
      const results = await runDailySentimentAggregation();
      console.log(`🤖 [${new Date().toISOString()}] Scheduled aggregation completed:`, {
        successful: results.totalProcessed,
        errors: results.totalErrors,
        duration: `${results.executionTime}ms`
      });
    } catch (error) {
      console.error(`🤖 [${new Date().toISOString()}] Scheduled aggregation failed:`, error);
    }
  }, {
    scheduled: true, // Start immediately when initialized
    timezone: "UTC"
  });

  console.log('🤖 Daily sentiment aggregation job initialized and started');
  return task;
}

/**
 * Run sentiment aggregation manually (for testing or one-time runs)
 * @param {Array<string>} customTickers - Optional custom ticker list
 */
async function runManualAggregation(customTickers = null) {
  const tickers = customTickers || DEFAULT_TICKERS;
  console.log(`🔧 Running manual sentiment aggregation for: ${tickers.join(', ')}`);
  
  try {
    const results = await runDailySentimentAggregation(tickers);
    console.log('🔧 Manual aggregation results:', results);
    return results;
  } catch (error) {
    console.error('🔧 Manual aggregation failed:', error);
    throw error;
  }
}

module.exports = {
  runDailySentimentAggregation,
  initializeDailySentimentJob,
  runManualAggregation,
  DEFAULT_TICKERS
}; 