# Caching Strategy Overview

This document provides a high-level overview of the caching strategies implemented across the HRVSTR application.

## Introduction

HRVSTR implements a sophisticated multi-tiered caching architecture designed to optimize performance, reduce API calls, and provide a seamless user experience even during network disruptions. The caching strategy varies by feature area, with each implementation tailored to the specific data characteristics and refresh requirements.

## Caching Approaches by Feature

The application implements three distinct caching approaches across its main features:

### 1. Sentiment Analysis

[Detailed documentation available in sentiment-caching.md](./sentiment-caching.md)

The Sentiment Analysis feature uses an **in-memory Map cache** with **variable TTL based on time range**:

- Short-term data (1 day): 2 minute TTL
- Long-term data (3 months): 30 minute TTL

Key characteristics:
- Fast in-memory access
- Time-based automatic expiration
- Sophisticated cache validation
- Graceful fallback to cached data on errors

### 2. SEC Filings

[Detailed documentation available in sec-filings-caching.md](./sec-filings-caching.md)

The SEC Filings feature implements **localStorage persistence** with **explicit cache management**:

- 30-minute staleness threshold
- User-triggered cache clearing
- Tab state persistence across sessions
- Server-side cache coordination

Key characteristics:
- Persistence across page reloads
- User-exposed cache controls
- Combined client/server caching
- Detailed loading states

### 3. Earnings Monitor

[Detailed documentation available in earnings-caching.md](./earnings-caching.md)

The Earnings Monitor uses **component state-based caching** with **on-demand analysis loading**:

- Component lifecycle-bound cache
- Computational fallbacks
- Manual refresh capability
- Time range-based fetching

Key characteristics:
- Emphasis on data freshness
- Lightweight component state storage
- Local computation fallbacks
- Progressive loading indicators

## Common Caching Patterns

Despite the differences in implementation, several patterns are consistent across all features:

1. **Multi-Layered Approach**
   - Client-side caching (browser)
   - Server-side proxy caching
   - Graceful degradation between layers

2. **Time Range Sensitivity**
   - Caching strategies adapt based on time range
   - Different expiration for different data volatility levels
   - Time-aware cache segmentation

3. **User Experience Focus**
   - Progressive loading indicators
   - Transparent cache status
   - Fallback to cached data during errors
   - Minimal UI disruption

4. **Proxy Server Integration**
   - All external API calls route through proxy
   - Consistent URL structure
   - Error handling standardization
   - Rate limiting protection

## Caching Tiers

The application implements caching at multiple tiers:

### Tier 1: In-Memory/Component State
- Fastest access speed
- Limited by session duration
- Used by Sentiment and Earnings features

### Tier 2: Browser Storage
- Persistent across sessions
- Larger storage capacity
- Used primarily by SEC Filings feature

### Tier 3: Proxy Server
- Shared across all users
- Reduces external API load
- Centralized rate limiting

### Tier 4: External APIs
- Original data sources
- Highest latency
- Subject to rate limits

## Recommended Future Enhancements

Based on the analysis of current implementations, potential improvements include:

1. **Unified Caching Service**
   - Create a central caching library used by all components
   - Standardize caching patterns and interfaces
   - Implement consistent cache invalidation

2. **Progressive Web App Features**
   - Add ServiceWorker caching
   - Enable offline functionality
   - Implement background sync

3. **Advanced Browser Storage**
   - Migrate from localStorage to IndexedDB
   - Implement structured data storage
   - Add query capabilities for cached data

4. **Smarter Refresh Strategies**
   - Implement staggered/progressive refresh
   - Add adaptive TTL based on data stability
   - Implement predictive prefetching

For detailed information about each feature's specific caching implementation, please refer to the dedicated documentation files.
