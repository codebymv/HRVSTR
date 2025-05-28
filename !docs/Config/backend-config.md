# Backend Configuration

## Express.js Server Configuration

The backend uses Express.js with TypeScript. Main server configuration is in `src/server.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://www.reddit.com", "https://finviz.com"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5173',  // Development
    'https://hrvstr.finance', // Production
    'https://www.hrvstr.finance'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

export default app;
```

## Redis Configuration

### Connection Setup
```typescript
// src/config/redis.ts
import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

export const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log('Redis connected successfully');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
};
```

### Caching Strategy
```typescript
// src/utils/cache.ts
import { redisClient } from '../config/redis';

export class CacheManager {
  static async get(key: string): Promise<any> {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  static async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  static async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  static async flush(): Promise<void> {
    try {
      await redisClient.flushAll();
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  }
}

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  SEC_FILINGS: 3600,    // 1 hour
  REDDIT_DATA: 1800,    // 30 minutes
  FINVIZ_DATA: 900,     // 15 minutes
  EARNINGS_DATA: 7200,  // 2 hours
  SENTIMENT_DATA: 1800  // 30 minutes
};
```

## Environment Configuration

### .env (Development)
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Redis Configuration
REDIS_URL=redis://localhost:6379

# API Keys
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
SEC_USER_AGENT=HRVSTR/1.0 (your.email@example.com)

# Internal API Key
API_KEY=your_internal_api_key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=debug

# External API URLs
FINVIZ_BASE_URL=https://finviz.com
REDDIT_BASE_URL=https://www.reddit.com
SEC_BASE_URL=https://www.sec.gov
```

### .env.production
```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Redis Configuration (Railway/Heroku Redis)
REDIS_URL=redis://user:password@hostname:port

# API Keys (Production)
REDDIT_CLIENT_ID=prod_reddit_client_id
REDDIT_CLIENT_SECRET=prod_reddit_client_secret
SEC_USER_AGENT=HRVSTR/1.0 (production@hrvstr.finance)

# Internal API Key
API_KEY=production_api_key_here

# Rate Limiting (Stricter in production)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50

# Logging
LOG_LEVEL=info

# External API URLs
FINVIZ_BASE_URL=https://finviz.com
REDDIT_BASE_URL=https://www.reddit.com
SEC_BASE_URL=https://www.sec.gov
```

## API Route Configuration

### Route Structure
```typescript
// src/routes/index.ts
import express from 'express';
import { secRoutes } from './sec';
import { redditRoutes } from './reddit';
import { finvizRoutes } from './finviz';
import { earningsRoutes } from './earnings';
import { sentimentRoutes } from './sentiment';
import { settingsRoutes } from './settings';

const router = express.Router();

// API version prefix
const API_VERSION = '/v1';

router.use(`${API_VERSION}/sec`, secRoutes);
router.use(`${API_VERSION}/reddit`, redditRoutes);
router.use(`${API_VERSION}/finviz`, finvizRoutes);
router.use(`${API_VERSION}/earnings`, earningsRoutes);
router.use(`${API_VERSION}/sentiment`, sentimentRoutes);
router.use(`${API_VERSION}/settings`, settingsRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

export default router;
```

## Middleware Configuration

### Authentication Middleware
```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';

export const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      error: true,
      message: 'Invalid or missing API key',
      code: 'UNAUTHORIZED'
    });
  }
  
  next();
};
```

### Error Handling Middleware
```typescript
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';

  console.error(`[ERROR] ${req.method} ${req.path}:`, err);

  res.status(statusCode).json({
    error: true,
    message,
    code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
```

### Request Logging Middleware
```typescript
// src/middleware/logger.ts
import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, path, query } = req;
    const { statusCode } = res;
    
    console.log(
      `[${new Date().toISOString()}] ${method} ${path} - ${statusCode} - ${duration}ms`,
      Object.keys(query).length > 0 ? { query } : ''
    );
  });
  
  next();
};
```

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "nodemon src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "type-check": "tsc --noEmit"
  }
}
```

## TypeScript Configuration

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/types/*": ["types/*"],
      "@/utils/*": ["utils/*"],
      "@/middleware/*": ["middleware/*"],
      "@/routes/*": ["routes/*"],
      "@/config/*": ["config/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

## Production Optimizations

### Performance Monitoring
```typescript
// src/middleware/performance.ts
import { Request, Response, NextFunction } from 'express';

export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    
    if (duration > 1000) { // Log slow requests (>1s)
      console.warn(`[SLOW REQUEST] ${req.method} ${req.path} - ${duration.toFixed(2)}ms`);
    }
  });
  
  next();
};
```

### Memory Management
```typescript
// src/utils/memoryMonitor.ts
export const monitorMemory = () => {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const usage = {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    if (usage.heapUsed > 500) { // Alert if heap usage > 500MB
      console.warn('[MEMORY WARNING] High memory usage:', usage);
    }
  }, 30000); // Check every 30 seconds
};
``` 