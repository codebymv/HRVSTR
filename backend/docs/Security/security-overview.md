# Security Overview

## Security Architecture

HRVSTR implements a multi-layered security approach to protect financial data, user privacy, and system integrity. The platform handles sensitive financial information and must comply with data protection standards while maintaining high availability.

## Core Security Principles

1. **Defense in Depth**: Multiple security layers at application, network, and infrastructure levels
2. **Least Privilege**: Minimal access rights for all components and users
3. **Zero Trust**: Verify every request regardless of source
4. **Data Protection**: Encryption in transit and at rest
5. **Audit Trail**: Comprehensive logging of all security events

## API Security

### Authentication & Authorization

#### API Key Authentication
```typescript
// API key validation middleware
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({
      error: true,
      message: 'API key required',
      code: 'MISSING_API_KEY'
    });
  }
  
  if (!isValidApiKey(apiKey)) {
    return res.status(401).json({
      error: true,
      message: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }
  
  // Log API usage
  logApiUsage(req, apiKey);
  next();
};

const isValidApiKey = (key: string): boolean => {
  // Validate against environment variable or database
  return key === process.env.API_KEY || validateDatabaseApiKey(key);
};
```

#### Rate Limiting
```typescript
// Enhanced rate limiting with different tiers
const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: true,
      message,
      code: 'RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
      // Use API key if available, otherwise IP
      return req.headers['x-api-key'] as string || req.ip;
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    }
  });
};

// Different rate limits for different endpoints
export const rateLimiters = {
  general: createRateLimiter(15 * 60 * 1000, 100, 'Too many requests'),
  sensitive: createRateLimiter(15 * 60 * 1000, 20, 'Rate limit exceeded for sensitive endpoint'),
  heavy: createRateLimiter(60 * 60 * 1000, 10, 'Too many resource-intensive requests')
};
```

### Input Validation & Sanitization

#### Request Validation
```typescript
// Input validation using Joi
import Joi from 'joi';

export const validateTicker = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    ticker: Joi.string()
      .alphanum()
      .min(1)
      .max(5)
      .uppercase()
      .required()
      .pattern(/^[A-Z]+$/)
  });
  
  const { error } = schema.validate(req.params);
  
  if (error) {
    return res.status(400).json({
      error: true,
      message: 'Invalid ticker symbol',
      code: 'INVALID_INPUT',
      details: error.details[0].message
    });
  }
  
  // Sanitize the ticker
  req.params.ticker = req.params.ticker.toUpperCase().trim();
  next();
};

// SQL injection prevention for any database queries
export const sanitizeInput = (input: string): string => {
  return input.replace(/[^\w\s-]/gi, '');
};
```

#### XSS Prevention
```typescript
// Content Security Policy headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.finance.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));
```

## Data Protection

### Encryption

#### Data in Transit
```typescript
// HTTPS enforcement
app.use((req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// TLS configuration
const tlsOptions = {
  minVersion: 'TLSv1.2',
  ciphers: [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-SHA256',
    'ECDHE-RSA-AES256-SHA384'
  ].join(':'),
  honorCipherOrder: true
};
```

#### Sensitive Data Handling
```typescript
// Encrypt sensitive configuration data
import crypto from 'crypto';

export class EncryptionService {
  private static algorithm = 'aes-256-gcm';
  private static key = crypto.scryptSync(process.env.ENCRYPTION_PASSWORD!, 'salt', 32);
  
  static encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.key);
    cipher.setAAD(Buffer.from('additional-auth-data'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }
  
  static decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const decipher = crypto.createDecipher(this.algorithm, this.key);
    decipher.setAAD(Buffer.from('additional-auth-data'));
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### Data Retention & Privacy

#### Automatic Data Cleanup
```typescript
// Clean up old cached data
export const dataRetentionCleanup = async () => {
  const retentionPolicies = {
    'reddit:*': 7 * 24 * 60 * 60,    // 7 days
    'sec:*': 30 * 24 * 60 * 60,      // 30 days
    'finviz:*': 3 * 24 * 60 * 60,    // 3 days
    'logs:*': 90 * 24 * 60 * 60      // 90 days
  };
  
  for (const [pattern, maxAge] of Object.entries(retentionPolicies)) {
    await cleanupDataByPattern(pattern, maxAge);
  }
};

const cleanupDataByPattern = async (pattern: string, maxAge: number) => {
  const keys = await redisClient.keys(pattern);
  const cutoffTime = Date.now() - (maxAge * 1000);
  
  for (const key of keys) {
    const ttl = await redisClient.ttl(key);
    if (ttl > 0 && ttl < cutoffTime) {
      await redisClient.del(key);
    }
  }
};
```

## Logging & Monitoring

### Security Event Logging
```typescript
// Security event logger
export class SecurityLogger {
  static logFailedAuth(req: Request, reason: string) {
    console.warn('[SECURITY] Failed authentication attempt', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      reason,
      timestamp: new Date().toISOString()
    });
  }
  
  static logSuspiciousActivity(req: Request, activity: string) {
    console.warn('[SECURITY] Suspicious activity detected', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      activity,
      timestamp: new Date().toISOString()
    });
    
    // Alert if multiple suspicious activities from same IP
    this.checkForRepeatedThreats(req.ip);
  }
  
  private static threatMap = new Map<string, number>();
  
  private static checkForRepeatedThreats(ip: string) {
    const count = this.threatMap.get(ip) || 0;
    this.threatMap.set(ip, count + 1);
    
    if (count > 5) {
      console.error('[SECURITY] Potential attack from IP:', ip);
      // Could implement IP blocking here
    }
  }
}
```

### Intrusion Detection
```typescript
// Simple intrusion detection patterns
export const intrusionDetection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /\b(union|select|insert|delete|drop|create|alter)\b/i,  // SQL injection
    /<script[^>]*>.*<\/script>/gi,                           // XSS
    /\.\.\//g,                                               // Path traversal
    /eval\s*\(/gi,                                           // Code injection
    /exec\s*\(/gi                                            // Command injection
  ];
  
  const requestString = JSON.stringify(req.body) + req.url + JSON.stringify(req.query);
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      SecurityLogger.logSuspiciousActivity(req, `Suspicious pattern detected: ${pattern.source}`);
      return res.status(400).json({
        error: true,
        message: 'Invalid request',
        code: 'SECURITY_VIOLATION'
      });
    }
  }
  
  next();
};
```

## Environment Security

### Environment Variable Protection
```typescript
// Validate critical environment variables on startup
export const validateEnvironment = () => {
  const requiredVars = [
    'API_KEY',
    'REDIS_URL',
    'ENCRYPTION_PASSWORD'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate API key strength
  if (process.env.API_KEY!.length < 32) {
    throw new Error('API_KEY must be at least 32 characters long');
  }
  
  console.log('Environment validation passed');
};
```

### Secrets Management
```typescript
// Secure secrets loading (for production use with secret management services)
export class SecretsManager {
  private static secrets = new Map<string, string>();
  
  static async loadSecrets() {
    // In production, load from AWS Secrets Manager, Azure Key Vault, etc.
    if (process.env.NODE_ENV === 'production') {
      await this.loadFromExternalService();
    } else {
      this.loadFromEnvironment();
    }
  }
  
  private static loadFromEnvironment() {
    this.secrets.set('API_KEY', process.env.API_KEY!);
    this.secrets.set('REDDIT_CLIENT_SECRET', process.env.REDDIT_CLIENT_SECRET!);
  }
  
  private static async loadFromExternalService() {
    // Implement external secrets service integration
    // Example: AWS Secrets Manager, Azure Key Vault, etc.
  }
  
  static getSecret(key: string): string | undefined {
    return this.secrets.get(key);
  }
}
```

## Security Headers

### HTTP Security Headers
```typescript
// Comprehensive security headers
app.use(helmet({
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  
  // Prevent MIME type sniffing
  noSniff: true,
  
  // XSS protection
  xssFilter: true,
  
  // Referrer policy
  referrerPolicy: { policy: 'same-origin' },
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
  
  // HSTS (HTTPS only)
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Custom security headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-API-Version', '1.0');
  res.setHeader('X-Response-Time', Date.now());
  next();
});
```

## Production Security Checklist

### Pre-deployment Security Audit
- [ ] All environment variables are properly secured
- [ ] API keys have sufficient entropy (minimum 32 characters)
- [ ] Rate limiting is configured for all endpoints
- [ ] Input validation is implemented for all user inputs
- [ ] Error messages don't leak sensitive information
- [ ] HTTPS is enforced in production
- [ ] Security headers are properly configured
- [ ] Logging captures security events
- [ ] Dependencies are updated and vulnerability-free
- [ ] Data retention policies are implemented

### Ongoing Security Monitoring
- Monitor for failed authentication attempts
- Track unusual API usage patterns
- Regular security dependency updates
- Periodic security audits
- Monitor Redis for unauthorized access
- Review logs for suspicious activity

This security framework provides comprehensive protection for the HRVSTR financial analysis platform while maintaining usability and performance. 