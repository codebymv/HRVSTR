# Data Management & Caching Strategy

## Overview

HRVSTR employs a sophisticated caching strategy to optimize performance when dealing with financial data from multiple external sources. The system uses Redis as the primary cache layer to reduce API calls, improve response times, and handle rate limiting effectively.

## Data Sources

### External APIs
1. **SEC EDGAR**: Insider trading (Form 4) and institutional holdings (13F)
2. **Reddit API**: Social sentiment from financial subreddits
3. **FinViz**: Market news, analyst ratings, technical indicators
4. **Yahoo Finance**: Stock prices and earnings data

### Data Characteristics
- **Volume**: High-frequency data updates for popular tickers
- **Latency**: Real-time to daily update frequencies
- **Reliability**: External dependencies with potential rate limits
- **Cost**: API call limitations and potential quotas

## Redis Caching Architecture

### Cache Layers

#### L1 Cache: Application Memory
- **Purpose**: Frequently accessed, small datasets
- **TTL**: 5-10 minutes
- **Implementation**: Node.js in-memory cache
- **Use Cases**: API responses for current user session

#### L2 Cache: Redis
- **Purpose**: Shared cache across multiple instances
- **TTL**: Variable based on data type (15 minutes to 24 hours)
- **Implementation**: Redis with configurable TTL
- **Use Cases**: External API responses, processed data

### Cache Key Strategy

```typescript
// Cache key patterns
const CACHE_KEYS = {
  SEC_INSIDER: (ticker: string) => `sec:insider:${ticker.toUpperCase()}`,
  SEC_HOLDINGS: (ticker: string) => `sec:holdings:${ticker.toUpperCase()}`,
  REDDIT_SENTIMENT: (ticker: string) => `reddit:sentiment:${ticker.toUpperCase()}`,
  FINVIZ_NEWS: (ticker: string) => `finviz:news:${ticker.toUpperCase()}`,
  EARNINGS_DATA: (ticker: string) => `earnings:${ticker.toUpperCase()}`,
  MARKET_SENTIMENT: () => `market:sentiment:${getCurrentDate()}`,
  TRENDING_TICKERS: () => `trending:tickers:${getCurrentHour()}`
};

// Helper functions
const getCurrentDate = () => new Date().toISOString().split('T')[0];
const getCurrentHour = () => new Date().toISOString().slice(0, 13);
```

## Cache TTL Strategy

### Time-Based TTL
```typescript
export const CACHE_TTL = {
  // Real-time data (frequent updates)
  REDDIT_POSTS: 15 * 60,        // 15 minutes
  FINVIZ_NEWS: 15 * 60,         // 15 minutes
  MARKET_SENTIMENT: 30 * 60,    // 30 minutes
  
  // Semi-static data (daily updates)
  SEC_INSIDER: 60 * 60,         // 1 hour
  SEC_HOLDINGS: 4 * 60 * 60,    // 4 hours
  EARNINGS_DATA: 2 * 60 * 60,   // 2 hours
  
  // Static data (infrequent updates)
  TICKER_INFO: 24 * 60 * 60,    // 24 hours
  COMPANY_PROFILE: 24 * 60 * 60, // 24 hours
  
  // Processed/computed data
  SENTIMENT_ANALYSIS: 30 * 60,   // 30 minutes
  TREND_ANALYSIS: 60 * 60       // 1 hour
};
```

### Dynamic TTL Based on Market Hours
```typescript
export const getDynamicTTL = (dataType: string): number => {
  const now = new Date();
  const isMarketHours = isMarketOpen(now);
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  
  if (isWeekend) {
    // Longer TTL on weekends
    return CACHE_TTL[dataType] * 4;
  }
  
  if (isMarketHours) {
    // Shorter TTL during market hours
    return CACHE_TTL[dataType] * 0.5;
  }
  
  // Standard TTL after hours
  return CACHE_TTL[dataType];
};
```

## Cache Implementation

### CacheManager Class
```typescript
export class CacheManager {
  private static redis = redisClient;
  
  // Get with fallback
  static async getWithFallback<T>(
    key: string, 
    fallbackFn: () => Promise<T>, 
    ttl: number = 3600
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get(key);
      if (cached !== null) {
        return cached as T;
      }
      
      // Execute fallback function
      const data = await fallbackFn();
      
      // Store in cache for future requests
      await this.set(key, data, ttl);
      
      return data;
    } catch (error) {
      console.error(`Cache fallback error for key ${key}:`, error);
      // If cache fails, execute fallback directly
      return await fallbackFn();
    }
  }
  
  // Batch operations
  static async mget(keys: string[]): Promise<any[]> {
    try {
      const values = await this.redis.mGet(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error('Cache mget error:', error);
      return new Array(keys.length).fill(null);
    }
  }
  
  static async mset(keyValuePairs: [string, any, number][]): Promise<void> {
    try {
      const pipeline = this.redis.multi();
      
      keyValuePairs.forEach(([key, value, ttl]) => {
        pipeline.setEx(key, ttl, JSON.stringify(value));
      });
      
      await pipeline.exec();
    } catch (error) {
      console.error('Cache mset error:', error);
    }
  }
  
  // Cache invalidation
  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
        console.log(`Invalidated ${keys.length} cache keys matching ${pattern}`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
}
```

## Smart Caching Strategies

### 1. Predictive Caching
```typescript
// Pre-cache popular tickers
export const preCachePopularTickers = async () => {
  const popularTickers = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN'];
  
  const cachePromises = popularTickers.map(async (ticker) => {
    const key = CACHE_KEYS.SEC_INSIDER(ticker);
    const exists = await CacheManager.exists(key);
    
    if (!exists) {
      // Pre-cache if not exists
      await CacheManager.getWithFallback(
        key,
        () => fetchSECInsiderData(ticker),
        CACHE_TTL.SEC_INSIDER
      );
    }
  });
  
  await Promise.all(cachePromises);
};
```

### 2. Cache Warming
```typescript
// Warm cache during off-peak hours
export const warmCache = async () => {
  console.log('Starting cache warming...');
  
  // Get trending tickers from Reddit
  const trendingTickers = await getTrendingTickers();
  
  // Pre-load data for trending tickers
  for (const ticker of trendingTickers.slice(0, 10)) {
    await Promise.all([
      preCacheSECData(ticker),
      preCacheRedditSentiment(ticker),
      preCacheFinVizNews(ticker)
    ]);
    
    // Prevent overwhelming external APIs
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('Cache warming completed');
};
```

### 3. Intelligent Cache Refresh
```typescript
// Refresh cache based on data freshness
export const refreshCacheIfStale = async (key: string, maxAge: number) => {
  const cacheInfo = await CacheManager.getWithTTL(key);
  
  if (cacheInfo.ttl < maxAge * 0.2) { // Refresh when 20% TTL remaining
    // Trigger background refresh
    setImmediate(async () => {
      try {
        await refreshCacheData(key);
      } catch (error) {
        console.error(`Background cache refresh failed for ${key}:`, error);
      }
    });
  }
};
```

## Cache Monitoring & Analytics

### Cache Hit Rate Tracking
```typescript
export class CacheMetrics {
  private static hits = 0;
  private static misses = 0;
  
  static recordHit() {
    this.hits++;
  }
  
  static recordMiss() {
    this.misses++;
  }
  
  static getHitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }
  
  static logMetrics() {
    console.log(`Cache hit rate: ${(this.getHitRate() * 100).toFixed(2)}%`);
    console.log(`Total hits: ${this.hits}, Total misses: ${this.misses}`);
  }
}
```

### Cache Size Monitoring
```typescript
export const monitorCacheSize = async () => {
  try {
    const info = await redisClient.info('memory');
    const usedMemory = info.split('\r\n')
      .find(line => line.startsWith('used_memory_human:'))
      ?.split(':')[1];
    
    console.log(`Redis memory usage: ${usedMemory}`);
    
    // Alert if memory usage is high
    const usedMemoryBytes = parseInt(
      info.split('\r\n')
        .find(line => line.startsWith('used_memory:'))
        ?.split(':')[1] || '0'
    );
    
    if (usedMemoryBytes > 100 * 1024 * 1024) { // 100MB threshold
      console.warn('High Redis memory usage detected');
    }
  } catch (error) {
    console.error('Cache monitoring error:', error);
  }
};
```

## Data Pipeline Optimization

### Batch Processing
```typescript
export const processBatchData = async (tickers: string[]) => {
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (ticker) => {
      const cacheKey = CACHE_KEYS.SEC_INSIDER(ticker);
      return CacheManager.getWithFallback(
        cacheKey,
        () => fetchSECInsiderData(ticker),
        CACHE_TTL.SEC_INSIDER
      );
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);
    
    // Rate limiting between batches
    if (i + batchSize < tickers.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
};
```

## Best Practices

### 1. Cache Key Naming
- Use consistent, hierarchical naming: `source:datatype:identifier`
- Include version numbers for schema changes: `v1:sec:insider:AAPL`
- Use uppercase for ticker symbols to avoid case sensitivity issues

### 2. Error Handling
- Always provide fallbacks when cache fails
- Log cache errors for monitoring
- Graceful degradation when Redis is unavailable

### 3. Memory Management
- Set appropriate TTLs to prevent memory bloat
- Use Redis EXPIRE to automatically clean up old data
- Monitor Redis memory usage and set memory limits

### 4. Performance Optimization
- Use pipeline operations for bulk cache operations
- Implement connection pooling for Redis
- Use compression for large cached objects

This caching strategy ensures HRVSTR can handle high-frequency financial data requests efficiently while maintaining data freshness and system reliability. 