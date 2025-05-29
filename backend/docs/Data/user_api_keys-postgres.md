# User API Keys Table

## Overview
The `user_api_keys` table stores per-user API credentials for external services. This allows users to provide their own API keys for services like Alpha Vantage, Reddit, SEC APIs, and others, enabling personalized rate limits and enhanced features.

## Schema

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | SERIAL | PRIMARY KEY | auto-increment | Unique API key record identifier |
| `user_id` | UUID | NOT NULL, FOREIGN KEY | - | References `users(id)` |
| `provider` | VARCHAR(50) | NOT NULL | - | API service provider name |
| `key_name` | VARCHAR(50) | NOT NULL | - | Type of key/credential |
| `key_value` | TEXT | - | NULL | Encrypted API key value |
| `created_at` | TIMESTAMP WITH TIME ZONE | - | `NOW()` | When key was added |
| `updated_at` | TIMESTAMP WITH TIME ZONE | - | `NOW()` | Last key update |

## Constraints

### Primary Key
- `id` (SERIAL): Auto-incrementing unique identifier

### Foreign Keys
- `user_id` → `users(id)` ON DELETE CASCADE

### Unique Constraints
- `(user_id, provider, key_name)`: One key per provider/type per user

## Indexes

### Performance Indexes
```sql
CREATE INDEX idx_user_api_keys_user_provider ON user_api_keys(user_id, provider);
```

### Recommended Additional Indexes
```sql
-- For provider-based queries
CREATE INDEX idx_user_api_keys_provider ON user_api_keys(provider);

-- For key lookups
CREATE INDEX idx_user_api_keys_user_key ON user_api_keys(user_id, key_name);
```

## Supported Providers

### Financial Data APIs
- `alpha_vantage` - Stock market data
- `iex_cloud` - Real-time financial data
- `quandl` - Economic and financial data
- `yahoo_finance` - Yahoo Finance API
- `polygon` - Market data API

### Social/News APIs
- `reddit` - Reddit API for sentiment analysis
- `twitter` - Twitter API for social sentiment
- `news_api` - News aggregation API

### Government/SEC APIs
- `sec` - SEC EDGAR API
- `finra` - FINRA API access
- `cftc` - CFTC data access

### Analysis APIs
- `openai` - AI-powered analysis
- `sentiment_api` - Sentiment analysis services

## Key Types by Provider

### Alpha Vantage
- `api_key` - Primary API key

### Reddit
- `client_id` - OAuth application ID
- `client_secret` - OAuth application secret
- `username` - Reddit username (if needed)
- `password` - Reddit password (if needed)

### IEX Cloud
- `api_key` - API token
- `secret_key` - Secret token (if applicable)

### SEC EDGAR
- `user_agent` - Required user agent string
- `api_key` - API key (if provided)

## Common Queries

### Get User's API Keys for Provider
```sql
SELECT key_name, key_value 
FROM user_api_keys 
WHERE user_id = $1 AND provider = $2;
```

### Store New API Key
```sql
INSERT INTO user_api_keys (user_id, provider, key_name, key_value) 
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, provider, key_name) 
DO UPDATE SET 
  key_value = $4,
  updated_at = NOW();
```

### Get All Providers for User
```sql
SELECT DISTINCT provider 
FROM user_api_keys 
WHERE user_id = $1 
ORDER BY provider;
```

### Delete API Key
```sql
DELETE FROM user_api_keys 
WHERE user_id = $1 AND provider = $2 AND key_name = $3;
```

### Check if User Has Keys for Provider
```sql
SELECT COUNT(*) > 0 as has_keys
FROM user_api_keys 
WHERE user_id = $1 AND provider = $2;
```

## Security Considerations

### Encryption
- All `key_value` fields should be encrypted at rest
- Use AES-256 encryption with user-specific salt
- Store encryption keys separate from database

### Example Encryption Implementation
```javascript
const crypto = require('crypto');

class APIKeyManager {
  constructor(encryptionKey) {
    this.algorithm = 'aes-256-gcm';
    this.key = Buffer.from(encryptionKey, 'hex');
  }

  encrypt(text, userId) {
    const iv = crypto.randomBytes(16);
    const salt = crypto.createHash('sha256').update(userId).digest();
    const cipher = crypto.createCipher(this.algorithm, Buffer.concat([this.key, salt]));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText, userId) {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const salt = crypto.createHash('sha256').update(userId).digest();
    const decipher = crypto.createDecipher(this.algorithm, Buffer.concat([this.key, salt]));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### Access Control
- Only show masked keys to users (e.g., `sk-...****`)
- Never log actual key values
- Implement rate limiting on key operations
- Audit key access and modifications

## Business Logic

### API Key Validation
```javascript
async function validateAPIKey(provider, keyType, keyValue) {
  const validators = {
    alpha_vantage: {
      api_key: (key) => /^[A-Z0-9]{10,20}$/.test(key)
    },
    reddit: {
      client_id: (key) => /^[A-Za-z0-9_-]{14,20}$/.test(key),
      client_secret: (key) => /^[A-Za-z0-9_-]{27,35}$/.test(key)
    },
    openai: {
      api_key: (key) => /^sk-[A-Za-z0-9]{48}$/.test(key)
    }
  };

  const validator = validators[provider]?.[keyType];
  if (!validator) {
    throw new Error(`Unknown provider/key type: ${provider}/${keyType}`);
  }

  if (!validator(keyValue)) {
    throw new Error(`Invalid ${keyType} format for ${provider}`);
  }

  // Additional API validation (test the key)
  return await testAPIKey(provider, keyType, keyValue);
}
```

### API Key Priority System
```javascript
async function getAPIKey(userId, provider, keyType) {
  // Try user's personal key first
  let result = await pool.query(
    'SELECT key_value FROM user_api_keys WHERE user_id = $1 AND provider = $2 AND key_name = $3',
    [userId, provider, keyType]
  );

  if (result.rows.length > 0) {
    return decrypt(result.rows[0].key_value, userId);
  }

  // Fall back to system default key
  return process.env[`${provider.toUpperCase()}_${keyType.toUpperCase()}`];
}
```

## User Interface Integration

### Key Management Frontend
```javascript
// API for frontend key management
const APIKeyService = {
  async getUserKeys(userId) {
    const response = await fetch('/api/user/api-keys', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.json();
  },

  async addKey(provider, keyName, keyValue) {
    return fetch('/api/user/api-keys', {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider, keyName, keyValue })
    });
  },

  async deleteKey(provider, keyName) {
    return fetch(`/api/user/api-keys/${provider}/${keyName}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
};
```

### User Experience
- Masked key display: `sk-proj-****`
- Key validation feedback
- Usage statistics per key
- Easy key rotation workflow

## Example Data

```sql
INSERT INTO user_api_keys (user_id, provider, key_name, key_value) 
VALUES 
  ('123e4567-e89b-12d3-a456-426614174000', 'alpha_vantage', 'api_key', 'encrypted_key_value_1'),
  ('123e4567-e89b-12d3-a456-426614174000', 'reddit', 'client_id', 'encrypted_client_id'),
  ('123e4567-e89b-12d3-a456-426614174000', 'reddit', 'client_secret', 'encrypted_client_secret'),
  ('789e4567-e89b-12d3-a456-426614174001', 'openai', 'api_key', 'encrypted_openai_key');
```

## Benefits of User-Provided Keys

### For Users
- Higher rate limits (using their own quotas)
- Access to premium features
- No shared rate limiting with other users
- Potential cost savings on usage

### For Platform
- Reduced API costs
- Better scalability
- Premium feature enablement
- User engagement and retention

## Monitoring & Analytics

### Key Usage Metrics
- Number of users with personal keys
- Most popular API providers
- Key validation success rates
- API call success rates with user keys

### Health Monitoring
```sql
-- Keys added in last 30 days by provider
SELECT provider, COUNT(*) as keys_added
FROM user_api_keys 
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY provider
ORDER BY keys_added DESC;

-- Users with multiple providers
SELECT user_id, COUNT(DISTINCT provider) as provider_count
FROM user_api_keys 
GROUP BY user_id 
HAVING COUNT(DISTINCT provider) > 1
ORDER BY provider_count DESC;
```

## Migration & Backup

### Data Migration
```sql
-- Migrate from old single-key system
INSERT INTO user_api_keys (user_id, provider, key_name, key_value)
SELECT id, 'alpha_vantage', 'api_key', alpha_vantage_key
FROM users 
WHERE alpha_vantage_key IS NOT NULL;
```

### Backup Considerations
- Encrypt backups containing API keys
- Separate backup storage for sensitive data
- Key rotation procedures
- Recovery testing protocols

## Compliance & Legal

### Data Protection
- GDPR compliance for EU users
- User consent for key storage
- Right to deletion/export
- Data retention policies

### Terms of Service
- User responsibility for key security
- Platform liability limitations
- API provider terms compliance
- Usage monitoring and reporting

## Related Files

- `backend/src/routes/api-keys.js` - API key management endpoints
- `backend/src/services/encryption.js` - Encryption/decryption utilities
- `backend/src/middleware/apiKeyAuth.js` - API key authentication
- `backend/create-user-api-keys-table.js` - Table creation script
- `frontend/src/components/APIKeyManager.tsx` - Key management UI

## Future Enhancements

### Planned Features
- Key expiration dates
- Usage analytics per key
- Automatic key rotation
- Multi-environment keys (dev/prod)
- Key sharing within organizations
- Integration testing automation 