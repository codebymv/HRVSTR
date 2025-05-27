# Reddit API Endpoints

## Overview

The Reddit API endpoints provide access to Reddit data, including posts, comments, and sentiment analysis from finance-related subreddits. These endpoints serve as a proxy to the official Reddit API, handling authentication, rate limiting, and data transformation.

## Base URL

```
/api/v1/reddit
```

## Available Endpoints

### Get Subreddit Posts

Retrieves top posts from a specified subreddit.

```
GET /api/v1/reddit/r/:subreddit/posts
```

#### Path Parameters

| Parameter  | Type   | Required | Description                                       |
|------------|--------|----------|---------------------------------------------------|
| subreddit  | string | Yes      | Name of the subreddit (e.g., "wallstreetbets")    |

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                            |
|-----------|--------|----------|---------|--------------------------------------------------------|
| timeRange | string | No       | "week"  | Time range for posts: "hour", "day", "week", "month", "year", "all" |
| limit     | number | No       | 100     | Maximum number of posts to retrieve (1-100)            |
| after     | string | No       | null    | Pagination token for the next set of results           |

#### Response Format

```json
{
  "posts": [
    {
      "id": "abcd123",
      "title": "AAPL earnings discussion",
      "author": "username",
      "created": 1619712345,
      "score": 420,
      "upvoteRatio": 0.89,
      "commentCount": 69,
      "url": "https://www.reddit.com/r/wallstreetbets/comments/abcd123/",
      "selftext": "What do you think about AAPL earnings?",
      "flair": "Discussion"
    },
    // Additional posts...
  ],
  "pagination": {
    "after": "t3_xyz789",
    "hasMore": true
  }
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/reddit/r/wallstreetbets/posts?timeRange=week&limit=10')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Ticker Sentiment

Analyzes sentiment for a specific ticker symbol based on Reddit posts.

```
GET /api/v1/reddit/sentiment/:ticker
```

#### Path Parameters

| Parameter | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| ticker    | string | Yes      | Stock symbol to analyze (e.g., "AAPL")        |

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| timeRange | string | No       | "1w"    | Time range: "1d", "1w", "1m", "3m"                    |
| subreddits| string | No       | null    | Comma-separated list of subreddits to include         |

#### Response Format

```json
{
  "ticker": "AAPL",
  "sentiment": {
    "score": 0.68,
    "label": "bullish",
    "confidence": 0.85
  },
  "stats": {
    "mentionCount": 47,
    "postCount": 12,
    "commentCount": 138,
    "averageScore": 0.68
  },
  "sources": {
    "subreddits": [
      {"name": "wallstreetbets", "mentionCount": 35, "averageScore": 0.72},
      {"name": "stocks", "mentionCount": 12, "averageScore": 0.56}
    ]
  },
  "timeRange": "1w",
  "timestamp": "2025-05-01T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/reddit/sentiment/AAPL?timeRange=1m')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Top Mentioned Tickers

Retrieves the most frequently mentioned stock tickers on Reddit.

```
GET /api/v1/reddit/trending
```

#### Query Parameters

| Parameter   | Type   | Required | Default | Description                                           |
|-------------|--------|----------|---------|-------------------------------------------------------|
| timeRange   | string | No       | "1w"    | Time range: "1d", "1w", "1m", "3m"                    |
| limit       | number | No       | 20      | Maximum number of tickers to retrieve (1-100)         |
| excludeMeme | boolean| No       | false   | Whether to exclude common "meme stocks"               |
| subreddits  | string | No       | null    | Comma-separated list of subreddits to include         |

#### Response Format

```json
{
  "trending": [
    {
      "ticker": "AAPL",
      "mentionCount": 342,
      "sentiment": 0.74,
      "sentimentLabel": "bullish",
      "changePercent": 15.3
    },
    {
      "ticker": "TSLA",
      "mentionCount": 298,
      "sentiment": 0.62,
      "sentimentLabel": "bullish",
      "changePercent": -8.5
    },
    // Additional tickers...
  ],
  "timeRange": "1w",
  "timestamp": "2025-05-01T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/reddit/trending?timeRange=1d&limit=10')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Search Reddit Posts

Searches for posts containing specific keywords or tickers.

```
GET /api/v1/reddit/search
```

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| q         | string | Yes      | -       | Search query (keywords or ticker symbols)             |
| timeRange | string | No       | "month" | Time range: "hour", "day", "week", "month", "year", "all" |
| limit     | number | No       | 25      | Maximum number of results to retrieve (1-100)         |
| subreddits| string | No       | null    | Comma-separated list of subreddits to search          |

#### Response Format

```json
{
  "results": [
    {
      "id": "abcd123",
      "title": "AAPL earnings surprise - 20% beat!",
      "author": "username",
      "created": 1619712345,
      "score": 1240,
      "commentCount": 387,
      "url": "https://www.reddit.com/r/wallstreetbets/comments/abcd123/",
      "subreddit": "wallstreetbets",
      "relevanceScore": 0.92
    },
    // Additional results...
  ],
  "query": "AAPL earnings",
  "resultCount": 15,
  "pagination": {
    "after": "t3_xyz789",
    "hasMore": true
  }
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/reddit/search?q=AAPL%20earnings&subreddits=wallstreetbets,stocks')
  .then(response => response.json())
  .then(data => console.log(data));
```

## Error Responses

### Invalid Subreddit

```json
{
  "error": true,
  "message": "Subreddit not found or private",
  "code": "SUBREDDIT_NOT_FOUND",
  "status": 404
}
```

### Invalid Ticker

```json
{
  "error": true,
  "message": "Invalid ticker symbol",
  "code": "INVALID_TICKER",
  "status": 400
}
```

### Rate Limiting

```json
{
  "error": true,
  "message": "Rate limit exceeded. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "status": 429,
  "retryAfter": 60
}
```

### Server Error

```json
{
  "error": true,
  "message": "Error fetching data from Reddit API",
  "code": "REDDIT_API_ERROR",
  "status": 500
}
```

## Caching Behavior

The Reddit API endpoints implement caching to optimize performance and respect Reddit's rate limits:

| Endpoint           | Cache Duration | Cache Key Components                           |
|--------------------|----------------|------------------------------------------------|
| /posts             | 15 minutes     | subreddit, timeRange, limit                    |
| /sentiment/:ticker | 30 minutes     | ticker, timeRange, subreddits                  |
| /trending          | 1 hour         | timeRange, limit, excludeMeme, subreddits      |
| /search            | 1 hour         | query, timeRange, limit, subreddits            |

## Limitations

1. **Rate Limits**: Respects Reddit API's rate limits (60 requests per minute)
2. **Post Limits**: Maximum of 100 posts can be retrieved in a single request
3. **Subreddit Access**: Only public subreddits are accessible
4. **Historical Data**: Limited to Reddit's availability (generally up to 1 year back)
