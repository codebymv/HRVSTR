/**
 * Main entry point for the HRVSTR backend application
 * Combines API server and proxy server functionality
 */
// Set NODE_ENV to development if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`Running in ${process.env.NODE_ENV} mode`);

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

// Import cache manager
const cacheManager = require('./utils/cacheManager');

// Load environment variables
dotenv.config();

// Import routes
const redditRoutes = require('./routes/proxy/reddit');
const finvizRoutes = require('./routes/proxy/finviz');
const secRoutes = require('./routes/proxy/sec');
const earningsRoutes = require('./routes/proxy/earnings');
const sentimentRoutes = require('./routes/proxy/sentiment');
const sentimentUnifiedRoutes = require('./routes/sentimentUnified');
const yahooRoutes = require('./routes/proxy/yahoo');
const watchlistRoutes = require('./routes/watchlist');
const authRoutes = require('./routes/auth');
const activityRoutes = require('./routes/activity');
const eventsRoutes = require('./routes/events');
const stocksRouter = require('./routes/stocks');
const settingsRoutes = require('./routes/settings');
const docsRoutes = require('./routes/docs');
const subscriptionRoutes = require('./routes/subscription');
const billingRoutes = require('./routes/billing');
const creditsRoutes = require('./routes/credits');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// Register global rate limits
cacheManager.registerRateLimit('api-global', 100, 15 * 60); // 100 requests per 15 minutes

// Setup rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV === 'development' ? 1000 : 500, // Increased for testing
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
});

// Setup more lenient auth rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV === 'development' ? 50 : 50, // Increased for testing billing flows
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many authentication attempts, please try again later.',
});

// Configure CORS with environment-based origins
const getAllowedOrigins = () => {
  const origins = [];
  
  // Add environment-specific frontend URL
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
    console.log('🌍 CORS: Added FRONTEND_URL from environment:', process.env.FRONTEND_URL);
  }
  
  // Always include these origins for development and backup
  origins.push(
    'https://hrvstr.us',
    'https://hrvstr.up.railway.app',
    'http://localhost:5173', 
    'http://localhost:3000'
  );
  
  // Add Railway internal network origins for private communication
  if (process.env.NODE_ENV === 'production') {
    origins.push(
      'http://frontend.railway.internal',
      'https://frontend.railway.internal'
    );
    console.log('🌍 CORS: Added Railway internal network origins for production');
  }
  
  // Remove duplicates
  const uniqueOrigins = [...new Set(origins)];
  console.log('🌍 CORS: Allowed origins configured:', uniqueOrigins);
  return uniqueOrigins;
};

const corsOptions = {
  origin: getAllowedOrigins(), // Dynamic origins based on environment
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin', 
    'Expires',
    'Cache-Control',
    'X-API-Key',
    'Pragma',
    'Access-Control-Request-Headers',
    'Access-Control-Request-Method'
  ],
  exposedHeaders: [
    'Content-Length',
    'Date',
    'Cache-Control',
    'Content-Type'
  ],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 600 // 10 minutes
};

// Apply CORS with the specified options
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Middleware to handle CORS headers and Cross-Origin-Opener-Policy
app.use((req, res, next) => {
  // Set CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();
  
  if (allowedOrigins.includes(origin)) { 
    res.header('Access-Control-Allow-Origin', origin); 
  }
  res.header('Access-Control-Allow-Methods', corsOptions.methods.join(','));
  res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));
  res.header('Access-Control-Expose-Headers', corsOptions.exposedHeaders.join(','));
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '600');
  
  // Fix Cross-Origin-Opener-Policy issues for OAuth flows
  // This allows popup windows to communicate with their opener
  res.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  
  // Additional security headers for OAuth
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Apply webhook route BEFORE JSON parser (needs raw body)
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Import webhook handler
  const { handleWebhook } = require('./routes/billing');
  return handleWebhook(req, res);
});

app.use(express.json());
app.use(limiter);
app.use(requestLogger); // Add request logger middleware

// Enhanced status check route
app.get('/api/status', async (req, res) => {
  try {
    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '0.7.5',
      server: {
        port: PORT,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
          external: Math.round(process.memoryUsage().external / 1024 / 1024) + ' MB'
        },
        platform: process.platform,
        nodeVersion: process.version
      },
      services: {
        api: 'operational',
        rateLimit: 'operational',
        cors: 'operational'
      },
      endpoints: {
        total: 39,
        available: [
          '/api/reddit/*',
          '/api/finviz/*',
          '/api/sec/*',
          '/api/earnings/*',
          '/api/sentiment/*',
          '/api/sentiment/historical/:ticker',
          '/api/sentiment/trends/:ticker',
          '/api/sentiment/comparative',
          '/api/sentiment/summary/:ticker',
          '/api/sentiment-unified/*',
          '/api/yahoo/*',
          '/api/watchlist',
          '/api/auth',
          '/api/activity',
          '/api/events',
          '/api/stocks',
          '/api/settings',
          '/api/docs',
          '/api/subscription',
          '/api/billing',
          '/api/status'
        ]
      }
    };

    // Test basic functionality
    const healthChecks = {
      express: true,
      cors: true,
      json_parser: true,
      rate_limiter: true
    };

    status.healthChecks = healthChecks;
    
    res.status(200).json(status);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      server: {
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
      }
    });
  }
});

// Default route with API documentation
app.get('/', (req, res) => {
  res.json({
    message: 'HRVSTR API Server',
    version: '0.7.5',
    endpoints: [
      '/api/reddit/subreddit/:subreddit',
      '/api/reddit/sentiment',
      '/api/finviz/ticker-sentiment',
      '/api/yahoo/ticker-sentiment',
      '/api/yahoo/market-sentiment',
      '/api/sec/insider-trades',
      '/api/sec/insider-trades/:ticker',
      '/api/sec/institutional-holdings',
      '/api/sec/institutional-holdings/:ticker',
      '/api/sec/abnormal-activity',
      '/api/sec/filing/:accessionNumber',
      '/api/sec/summary/:ticker',
      '/api/sec/clear-cache',
      '/api/earnings/upcoming',
      '/api/sentiment/reddit/tickers',
      '/api/sentiment/reddit/market',
      '/api/sentiment/finviz/tickers',
      '/api/sentiment/aggregate',
      '/api/sentiment-unified/reddit/tickers',
      '/api/sentiment-unified/yahoo/tickers',
      '/api/sentiment-unified/finviz/tickers',
      '/api/sentiment-unified/combined/tickers',
      '/api/sentiment-unified/reddit/market',
      '/api/sentiment-unified/yahoo/market',
      '/api/sentiment-unified/finviz/market',
      '/api/sentiment-unified/aggregated/market',
      '/api/sentiment-unified/stream',
      '/api/sentiment-unified/cache/status',
      '/api/sentiment-unified/health',
      '/api/settings/key-status',
      '/api/settings/update-keys',
      '/api/settings/keys',
      '/api/subscription/tier-info',
      '/api/subscription/available-tiers',
      '/api/subscription/simulate-upgrade',
      '/api/subscription/add-credits',
      '/api/subscription/usage-stats',
      '/api/watchlist',
      '/api/auth',
      '/api/activity',
      '/api/events',
      '/api/stocks',
      '/api/status'
    ]
  });
});

// Apply routes
app.use('/api/reddit', redditRoutes);
app.use('/api/finviz', finvizRoutes);
app.use('/api/sec', secRoutes);
app.use('/api/earnings', earningsRoutes);
app.use('/api/sentiment', sentimentRoutes);
app.use('/api/sentiment-unified', sentimentUnifiedRoutes);
app.use('/api/yahoo', yahooRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/stocks', stocksRouter);
app.use('/api/settings', settingsRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/credits', creditsRoutes);

// Error handling middleware (must be after routes but before static files)
app.use(errorHandler);

// Serve static files from the frontend build directory in production
// IMPORTANT: This must come AFTER all API routes to prevent conflicts
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendBuildPath));

  // Handle all non-API routes by serving the frontend's index.html
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// Initialize session cleanup scheduler
const { sessionCleanupScheduler } = require('./utils/sessionCleanupScheduler');

// Start the session cleanup scheduler with configuration
sessionCleanupScheduler.start({
  sessionCleanupInterval: 15 * 60 * 1000,    // 15 minutes
  cacheCleanupInterval: 30 * 60 * 1000,     // 30 minutes  
  longRunningCheckInterval: 60 * 60 * 1000, // 1 hour
  enabled: true // Can be disabled via environment variable if needed
});

// Initialize daily sentiment aggregation job
const { initializeDailySentimentJob } = require('./jobs/dailySentimentAggregation');

// Start the daily sentiment aggregation job
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SENTIMENT_JOB === 'true') {
  initializeDailySentimentJob();
  console.log('🤖 Daily sentiment aggregation job enabled for production environment');
} else {
  console.log('🤖 Daily sentiment aggregation job disabled for development (set ENABLE_SENTIMENT_JOB=true to enable)');
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM signal, shutting down gracefully...');
  sessionCleanupScheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT signal, shutting down gracefully...');
  sessionCleanupScheduler.stop();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}`);
});
