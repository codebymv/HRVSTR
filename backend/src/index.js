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

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

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
  origin: true, // Allow all origins in production
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

// Middleware to handle CORS headers
app.use((req, res, next) => {
  // Set CORS headers
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', corsOptions.methods.join(','));
  res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));
  res.header('Access-Control-Expose-Headers', corsOptions.exposedHeaders.join(','));
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '600');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

app.use(express.json());
app.use(limiter);
app.use(requestLogger); // Add request logger middleware

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Default route with API documentation
app.get('/', (req, res) => {
  res.json({
    message: 'HRVSTR API Server',
    version: '1.0.0',
    endpoints: [
      '/api/reddit/subreddit/:subreddit',
      '/api/reddit/sentiment',
      '/api/finviz/ticker-sentiment',
      '/api/yahoo/ticker-sentiment',
      '/api/yahoo/market-sentiment',
      '/api/sec/insider-trades',
      '/api/sec/institutional-holdings',
      '/api/earnings/upcoming',
      '/api/sentiment/reddit/tickers',
      '/api/sentiment/reddit/market',
      '/api/sentiment/finviz/tickers',
      '/api/sentiment/aggregate',
      '/api/settings/update-keys',
      '/health'
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