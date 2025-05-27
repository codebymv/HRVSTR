/**
 * Sentiment Service Facade
 * Delegates implementation to modular services.
 */
module.exports = {
  ...require('./redditSentimentService'),
  ...require('./finvizSentimentService'),
  ...require('./aggregatedSentimentService'),
};