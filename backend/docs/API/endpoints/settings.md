# Settings API Endpoints

## Overview

The Settings API endpoints manage user preferences, API key configuration, and application settings. These endpoints require authentication and provide secure storage for user-specific configuration data.

## Base URL

```
/api/settings
```

## Authentication

All settings endpoints require JWT authentication:

```http
Authorization: Bearer <jwt_token>
```

## Available Endpoints

### Get API Key Status

Retrieves the configuration status of API keys for external data sources.

```http
GET /api/settings/key-status
```

#### Authentication
- **Required**: Yes
- **Tier Access**: Available to all user tiers

#### Response Format

```json
{
  "success": true,
  "keyStatus": {
    "reddit_client_id": true,
    "reddit_client_secret": true,
    "alpha_vantage_key": false,
    "finviz_key": false,
    "sec_key": true
  },
  "dataSourceStatus": {
    "reddit": true,
    "alpha_vantage": false,
    "finviz": false,
    "sec": true
  },
  "timestamp": "2024-05-06T12:00:00Z"
}
```

#### Key Status Explanation
- `true`: API key is configured (either user-provided or environment variable)
- `false`: API key is missing and needs to be configured

#### Data Source Status
- Combined status for data sources requiring multiple keys
- `reddit`: Requires both `reddit_client_id` and `reddit_client_secret`
- Other sources: Single key requirement

### Update API Keys

Updates or adds API keys for external data sources.

```http
POST /api/settings/update-keys
```

#### Authentication
- **Required**: Yes
- **Tier Access**: Available to all user tiers

#### Request Body

```json
{
  "apiKeys": {
    "reddit_client_id": "your_reddit_client_id",
    "reddit_client_secret": "your_reddit_client_secret",
    "alpha_vantage_key": "your_alpha_vantage_key",
    "finviz_key": "your_finviz_key",
    "sec_key": "your_sec_key"
  }
}
```

#### Response Format

```json
{
  "success": true,
  "message": "API keys updated successfully",
  "timestamp": "2024-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
const updateApiKeys = async (keys) => {
  const response = await fetch('/api/settings/update-keys', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apiKeys: keys
    })
  });

  return await response.json();
};
```

### Get Masked API Keys

Retrieves user's API keys in masked format for display purposes.

```http
GET /api/settings/keys
```

#### Authentication
- **Required**: Yes
- **Tier Access**: Available to all user tiers

#### Response Format

```json
{
  "success": true,
  "keys": {
    "reddit_client_id": "abc***xyz",
    "reddit_client_secret": "def***uvw",
    "alpha_vantage_key": "",
    "finviz_key": "",
    "sec_key": "ghi***rst"
  },
  "timestamp": "2024-05-06T12:00:00Z"
}
```

#### Masking Rules
- Shows first 3 and last 3 characters
- Middle characters replaced with `***`
- Empty string for unconfigured keys

### Get Unmasked API Keys

Retrieves actual unmasked API keys for viewing (admin/debug purposes).

```http
GET /api/settings/keys-unmasked
```

#### Authentication
- **Required**: Yes
- **Tier Access**: Available to all user tiers
- **Security Note**: Use with caution, exposes actual keys

#### Response Format

```json
{
  "success": true,
  "keys": {
    "reddit_client_id": "actual_reddit_client_id",
    "reddit_client_secret": "actual_reddit_client_secret",
    "alpha_vantage_key": "",
    "finviz_key": "",
    "sec_key": "actual_sec_key"
  },
  "timestamp": "2024-05-06T12:00:00Z"
}
```

## Supported API Keys

### Reddit API Keys
- **reddit_client_id**: Reddit application client ID
- **reddit_client_secret**: Reddit application client secret
- **Usage**: Access Reddit data for sentiment analysis
- **Required**: Both keys needed for Reddit data access

### Alpha Vantage API Key
- **alpha_vantage_key**: Alpha Vantage API key
- **Usage**: Stock price data and financial metrics
- **Free Tier**: 5 requests per minute, 500 per day

### FinViz API Key
- **finviz_key**: FinViz API key (if required)
- **Usage**: News sentiment and technical indicators
- **Note**: May not require key for basic scraping

### SEC API Key
- **sec_key**: SEC EDGAR API key (if required)
- **Usage**: Insider trading and institutional holdings data
- **Note**: SEC generally doesn't require API keys

## Key Storage and Security

### Encryption
- All user-provided API keys are encrypted before storage
- Keys are stored in the `user_api_keys` table
- Environment variables used as fallback for system-wide keys

### Key Validation
- Keys are validated before storage when possible
- Invalid keys are rejected with appropriate error messages
- Validation varies by data source capabilities

### Key Hierarchy
1. **User-provided keys**: Highest priority, stored encrypted
2. **Environment variables**: System-wide fallback keys
3. **No key**: Feature unavailable, user prompted to add key

## Error Handling

### Common Errors

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | `Invalid API keys data` | Request body format invalid |
| 401 | `Authentication required` | Missing or invalid JWT token |
| 500 | `Failed to save API keys` | Database error during save |
| 500 | `Failed to fetch API keys` | Database error during retrieval |

### Example Error Response

```json
{
  "success": false,
  "error": "Invalid API keys data",
  "status": 400
}
```

## Integration with Data Sources

### Automatic Fallback
When user hasn't provided keys, system uses environment variables:

```javascript
// Key resolution logic
const getEffectiveApiKey = (userKey, envKey) => {
  return userKey && userKey.trim() ? userKey : envKey;
};

// Check if data source is available
const isDataSourceAvailable = (requiredKeys) => {
  return requiredKeys.every(key => 
    userKeys[key] || process.env[key.toUpperCase()]
  );
};
```

### Data Source Validation
Before making API calls, system checks key availability:

```javascript
// Example: Reddit data request
if (!dataSourceStatus.reddit) {
  return {
    error: true,
    message: "Reddit API keys not configured. Please add keys in settings.",
    code: "MISSING_API_KEYS"
  };
}
```

## User Experience

### Settings UI Integration
- Settings page displays key status with visual indicators
- Users can add/update keys through secure form
- Masked display protects sensitive information
- Real-time validation provides immediate feedback

### Key Setup Workflow
1. User visits settings page
2. System shows which keys are missing
3. User adds keys through form
4. Keys are validated and saved
5. Data source status updates immediately
6. User can access previously unavailable features

## Rate Limiting

### API Key Management
- Key update operations are rate-limited per user
- Prevents abuse of encryption/decryption operations
- Standard rate limits apply (based on user tier)

### Data Source Limits
- User-provided keys subject to their own rate limits
- System tracks usage to prevent exceeding limits
- Environment variable keys shared across all users

## Migration and Compatibility

### Legacy System
- Previous system used server-side API keys only
- New system allows user-provided keys for personalization
- Fallback maintains compatibility for users without keys

### Key Migration
- Existing users continue using environment variable keys
- Optional upgrade to user-provided keys for better limits
- No breaking changes to existing functionality

## Usage Examples

### Check Key Configuration Status

```javascript
const checkKeyStatus = async () => {
  try {
    const response = await fetch('/api/settings/key-status', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    const data = await response.json();
    
    // Check if Reddit is available
    if (!data.dataSourceStatus.reddit) {
      showRedditKeyPrompt();
    }
    
    return data;
  } catch (error) {
    console.error('Error checking key status:', error);
  }
};
```

### Update Multiple API Keys

```javascript
const updateMultipleKeys = async (newKeys) => {
  try {
    const response = await fetch('/api/settings/update-keys', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiKeys: newKeys
      })
    });

    const data = await response.json();
    
    if (data.success) {
      showSuccessMessage('API keys updated successfully');
      // Refresh key status
      await checkKeyStatus();
    } else {
      showErrorMessage(data.error);
    }
    
    return data;
  } catch (error) {
    console.error('Error updating keys:', error);
    showErrorMessage('Failed to update API keys');
  }
};
```

### Display Masked Keys

```javascript
const displayUserKeys = async () => {
  try {
    const response = await fetch('/api/settings/keys', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    const data = await response.json();
    
    if (data.success) {
      // Display masked keys in UI
      Object.entries(data.keys).forEach(([keyName, maskedValue]) => {
        const element = document.getElementById(`key-${keyName}`);
        if (element) {
          element.textContent = maskedValue || 'Not configured';
        }
      });
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching keys:', error);
  }
};
```

## Related Endpoints

### User Profile
- `GET /api/auth/profile` - Get user information and tier

### Data Source Status
- `GET /api/reddit/*` - Reddit endpoints requiring keys
- `GET /api/sec/*` - SEC endpoints 
- `GET /api/sentiment/*` - Sentiment analysis endpoints

### Subscription Management
- `GET /api/subscription/tier-info` - Current subscription tier
- `GET /api/subscription/usage-stats` - API usage statistics

## Security Considerations

### Key Protection
- Never log actual API keys
- Use HTTPS for all key transmission
- Encrypt keys at rest in database
- Mask keys in UI display

### Access Control
- Users can only access their own keys
- No cross-user key access possible
- Admin access requires separate authentication

### Best Practices
- Rotate API keys regularly
- Use least-privilege access
- Monitor unusual usage patterns
- Implement key expiration where possible

## Related Files

- `backend/src/routes/settings.js` - Settings route definitions
- `backend/src/utils/userApiKeys.js` - Key management utilities
- `backend/src/middleware/authMiddleware.js` - Authentication middleware
- `frontend/src/pages/Settings.tsx` - Settings UI components
- `frontend/src/services/settingsService.js` - Frontend API integration
