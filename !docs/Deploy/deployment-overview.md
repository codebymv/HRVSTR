# Deployment Overview

## Deployment Strategy

HRVSTR uses Railway as the primary deployment platform, providing seamless deployment with automatic scaling, integrated Redis, and easy environment management. The platform supports both staging and production environments.

## Deployment Platforms

### Primary: Railway
- **Backend**: Node.js service with automatic builds
- **Frontend**: Static site deployment
- **Database**: Integrated Redis for caching
- **Monitoring**: Built-in metrics and logging
- **SSL**: Automatic HTTPS with custom domains

### Alternative: Heroku
- Supported as backup deployment option
- Redis add-on integration
- Dyno-based scaling
- Pipeline support for staging/production

## Repository Structure for Deployment

```
hrvstr/
├── railway.toml          # Railway configuration
├── Dockerfile           # Optional containerization
├── package.json         # Root package.json for monorepo
├── backend/
│   ├── package.json     # Backend dependencies
│   ├── src/            # Source code
│   └── dist/           # Built files (gitignored)
├── frontend/
│   ├── package.json     # Frontend dependencies
│   ├── src/            # Source code
│   └── dist/           # Built files (gitignored)
└── !docs/              # Documentation
```

## Railway Configuration

### railway.toml
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[[services]]
name = "hrvstr-backend"
source = "backend"

[services.variables]
NODE_ENV = "production"
PORT = "3001"

[[services]]
name = "hrvstr-frontend"
source = "frontend"

[services.variables]
VITE_API_BASE_URL = "${{Prep.BACKEND_URL}}"
```

## Environment Configuration

### Production Environment Variables

#### Backend (.env.production)
```env
# Server Configuration
NODE_ENV=production
PORT=3001

# Redis Configuration (Railway Redis)
REDIS_URL=${{Redis.REDIS_URL}}

# API Keys (use Railway secrets)
REDDIT_CLIENT_ID=${{Prep.REDDIT_CLIENT_ID}}
REDDIT_CLIENT_SECRET=${{Prep.REDDIT_CLIENT_SECRET}}
SEC_USER_AGENT=HRVSTR/1.0 (production@hrvstr.finance)

# Internal API Key
API_KEY=${{Prep.API_KEY}}

# Rate Limiting (Production settings)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50

# Logging
LOG_LEVEL=info

# Security
ENCRYPTION_PASSWORD=${{Prep.ENCRYPTION_PASSWORD}}

# External API URLs
FINVIZ_BASE_URL=https://finviz.com
REDDIT_BASE_URL=https://www.reddit.com
SEC_BASE_URL=https://www.sec.gov
```

#### Frontend (.env.production)
```env
VITE_API_BASE_URL=https://hrvstr-backend.railway.app
VITE_API_KEY=${{Prep.API_KEY}}
VITE_APP_TITLE=HRVSTR
VITE_ENABLE_ANALYTICS=true
```

## Deployment Process

### Automated Deployment (Recommended)

#### 1. Railway Setup
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link project to Railway
railway link

# Deploy backend
cd backend
railway up --service hrvstr-backend

# Deploy frontend
cd ../frontend
railway up --service hrvstr-frontend
```

#### 2. Environment Variables Setup
```bash
# Set production secrets via Railway CLI
railway variables set API_KEY="your-strong-api-key-here"
railway variables set REDDIT_CLIENT_ID="your-reddit-client-id"
railway variables set REDDIT_CLIENT_SECRET="your-reddit-client-secret"
railway variables set ENCRYPTION_PASSWORD="your-encryption-password"

# Add Redis service
railway add redis
```

### Manual Deployment

#### Build Process
```bash
# Build backend
cd backend
npm run build

# Build frontend
cd ../frontend
npm run build
```

#### Docker Deployment (Optional)

##### Backend Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start application
CMD ["npm", "start"]
```

##### Frontend Dockerfile
```dockerfile
FROM nginx:alpine

# Copy built files
COPY dist/ /usr/share/nginx/html/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

## Production Optimizations

### Backend Optimizations
```javascript
// Production-specific configurations
if (process.env.NODE_ENV === 'production') {
  // Enable compression
  app.use(compression());
  
  // Trust proxy (Railway/Heroku)
  app.set('trust proxy', 1);
  
  // Production error handling
  app.use((err, req, res, next) => {
    console.error('Production error:', err);
    res.status(500).json({
      error: true,
      message: 'Internal server error'
    });
  });
  
  // Production logging
  const winston = require('winston');
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
      new winston.transports.Console({
        format: winston.format.simple()
      })
    ]
  });
}
```

### Frontend Optimizations
```typescript
// vite.config.ts production optimizations
export default defineConfig({
  build: {
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          ui: ['@radix-ui/react-slot']
        }
      }
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

## Database & Caching

### Redis Configuration
```typescript
// Production Redis configuration
const redisConfig = {
  url: process.env.REDIS_URL,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  connectTimeout: 60000,
  commandTimeout: 5000
};

// Connection with retry logic
const connectWithRetry = async () => {
  try {
    await redisClient.connect();
    console.log('Redis connected successfully');
  } catch (error) {
    console.error('Redis connection failed, retrying in 5s...', error);
    setTimeout(connectWithRetry, 5000);
  }
};
```

## Monitoring & Health Checks

### Health Check Endpoint
```typescript
// Comprehensive health check
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    services: {}
  };
  
  try {
    // Check Redis connection
    await redisClient.ping();
    health.services.redis = 'healthy';
  } catch (error) {
    health.services.redis = 'unhealthy';
    health.status = 'degraded';
  }
  
  // Check external APIs (optional)
  try {
    const response = await fetch('https://www.reddit.com/api/v1/me', {
      timeout: 5000
    });
    health.services.reddit = response.ok ? 'healthy' : 'degraded';
  } catch (error) {
    health.services.reddit = 'unknown';
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

### Application Metrics
```typescript
// Metrics collection for monitoring
export class Metrics {
  private static requests = 0;
  private static errors = 0;
  private static responseTime: number[] = [];
  
  static incrementRequests() {
    this.requests++;
  }
  
  static incrementErrors() {
    this.errors++;
  }
  
  static addResponseTime(time: number) {
    this.responseTime.push(time);
    if (this.responseTime.length > 1000) {
      this.responseTime = this.responseTime.slice(-1000);
    }
  }
  
  static getMetrics() {
    const avgResponseTime = this.responseTime.length > 0
      ? this.responseTime.reduce((a, b) => a + b, 0) / this.responseTime.length
      : 0;
      
    return {
      requests: this.requests,
      errors: this.errors,
      errorRate: this.requests > 0 ? this.errors / this.requests : 0,
      averageResponseTime: avgResponseTime,
      memoryUsage: process.memoryUsage()
    };
  }
}
```

## Rollback Strategy

### Blue-Green Deployment
```bash
# Create new deployment
railway up --service hrvstr-backend-new

# Test new deployment
curl https://hrvstr-backend-new.railway.app/health

# Switch traffic (if successful)
railway domain add hrvstr.finance --service hrvstr-backend-new
railway domain remove hrvstr.finance --service hrvstr-backend

# Cleanup old deployment
railway delete --service hrvstr-backend
railway rename hrvstr-backend-new hrvstr-backend
```

### Quick Rollback
```bash
# Rollback to previous deployment
railway rollback --service hrvstr-backend

# Or deploy specific version
railway up --service hrvstr-backend --detach
```

## Security Considerations

### Production Security Checklist
- [ ] All API keys stored as Railway secrets
- [ ] HTTPS enforced for all endpoints
- [ ] Rate limiting configured appropriately
- [ ] CORS configured for production domains only
- [ ] Error messages don't leak sensitive information
- [ ] Security headers configured
- [ ] Dependencies updated and scanned for vulnerabilities
- [ ] Redis protected with authentication
- [ ] Logging configured for security events

### Environment Isolation
- Separate Railway projects for staging and production
- Different API keys for each environment
- Isolated Redis instances
- Different rate limiting settings
- Separate monitoring and alerting

This deployment strategy ensures reliable, scalable, and secure deployment of the HRVSTR platform with proper monitoring and rollback capabilities. 