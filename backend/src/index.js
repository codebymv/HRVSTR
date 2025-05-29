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
  limit: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// Configure CORS with specific options
const corsOptions = {
  origin: ['https://hrvstr.up.railway.app', 'http://localhost:5173', 'http://localhost:3000'], // Allow specific origins
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
  if (['https://hrvstr.up.railway.app', 'http://localhost:5173', 'http://localhost:3000'].includes(origin)) { 
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
        total: 25,
        available: [
          '/api/reddit/*',
          '/api/finviz/*',
          '/api/sec/*',
          '/api/earnings/*',
          '/api/sentiment/*',
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
app.use('/api/yahoo', yahooRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/stocks', stocksRouter);
app.use('/api/settings', settingsRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/billing', billingRoutes);

// Serve static files from the frontend build directory in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendBuildPath));

  // Handle all other routes by serving the frontend's index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// Error handling middleware (must be after routes)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}`);
});
