const express = require('express');
const router = express.Router();
const { pool } = require('../config/data-sources');
const authenticateToken = require('../middleware/authMiddleware');

// Helper function to mask API keys for display (show first 4 and last 4 chars)
const maskApiKey = (key) => {
  if (!key || key.length < 8) return '●●●●●●●●';
  return key.substring(0, 4) + '●'.repeat(Math.max(4, key.length - 8)) + key.substring(key.length - 4);
};

// Load API keys for a specific user from database
const loadUserApiKeys = async (userId) => {
  try {
    const result = await pool.query(
      'SELECT provider, key_name, key_value FROM user_api_keys WHERE user_id = $1',
      [userId]
    );
    
    const keys = {};
    result.rows.forEach(row => {
      const keyIdentifier = `${row.provider === 'reddit' && row.key_name === 'client_id' ? 'reddit_client_id' :
                             row.provider === 'reddit' && row.key_name === 'client_secret' ? 'reddit_client_secret' :
                             row.provider === 'alpha_vantage' ? 'alpha_vantage_key' :
                             row.provider === 'fmp' ? 'fmp_key' :
                             `${row.provider}_${row.key_name}`}`;
      keys[keyIdentifier] = row.key_value;
    });
    
    return keys;
  } catch (error) {
    console.error('Error loading user API keys:', error);
    return {};
  }
};

// Save API keys for a specific user to database
const saveUserApiKeys = async (userId, apiKeys) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const [keyIdentifier, keyValue] of Object.entries(apiKeys)) {
      if (!keyValue || !keyValue.trim()) continue; // Skip empty keys
      
      // Parse key identifier to provider and key_name
      let provider, keyName;
      if (keyIdentifier === 'reddit_client_id') {
        provider = 'reddit';
        keyName = 'client_id';
      } else if (keyIdentifier === 'reddit_client_secret') {
        provider = 'reddit';
        keyName = 'client_secret';
      } else if (keyIdentifier === 'alpha_vantage_key') {
        provider = 'alpha_vantage';
        keyName = 'api_key';
      } else if (keyIdentifier === 'fmp_key') {
        provider = 'fmp';
        keyName = 'api_key';
      } else if (keyIdentifier === 'finviz_key') {
        provider = 'finviz';
        keyName = 'api_key';
      } else if (keyIdentifier === 'sec_key') {
        provider = 'sec';
        keyName = 'api_key';
      } else {
        continue; // Skip unknown keys
      }
      
      // Upsert the key
      await client.query(
        `INSERT INTO user_api_keys (user_id, provider, key_name, key_value, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, provider, key_name)
         DO UPDATE SET key_value = $4, updated_at = NOW()`,
        [userId, provider, keyName, keyValue.trim()]
      );
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving user API keys:', error);
    return false;
  } finally {
    client.release();
  }
};

// GET /api/settings/key-status
// Returns the status of configured API keys for the authenticated user
router.get('/key-status', authenticateToken, async (req, res) => {
  try {
    const userApiKeys = await loadUserApiKeys(req.user.id);
    const userTier = req.user.tier || 'free';
    
    // Check which keys are configured (have non-empty values)
    const keyStatus = {};
    const dataSourceStatus = {};
    
    // Define expected API keys and their related data sources
    const expectedKeys = {
      'reddit_client_id': 'reddit',
      'reddit_client_secret': 'reddit',
      'alpha_vantage_key': 'alpha_vantage',
      'fmp_key': 'fmp',
      'finviz_key': 'finviz',
      'sec_key': 'sec'
    };

    // Check status of each expected key - check both user keys AND environment variables
    Object.keys(expectedKeys).forEach(keyName => {
      // Check if key is available from user config OR environment variables
      const userKey = userApiKeys[keyName] && userApiKeys[keyName].trim();
      
      // For BYOK services (Reddit, Alpha Vantage, FMP), only check user-provided keys
      // For built-in services (FinViz, Yahoo, SEC), these should always be available
      let keyIsAvailable = false;
      
      if (keyName === 'reddit_client_id' || keyName === 'reddit_client_secret' || keyName === 'fmp_key') {
        // BYOK services - only check user-provided keys
        keyIsAvailable = !!userKey;
      } else if (keyName === 'alpha_vantage_key') {
        // Alpha Vantage - BYOK + tier restriction (Pro+ only)
        // Free tier users cannot configure Alpha Vantage keys at all
        if (userTier === 'free') {
          keyIsAvailable = false; // Always false for free tier users
        } else {
          keyIsAvailable = !!userKey; // Pro+ users can configure their own keys
        }
      } else if (keyName === 'finviz_key' || keyName === 'sec_key') {
        // Built-in services - always available (no external keys required)
        keyIsAvailable = true;
      } else {
        // For any other services, check both user keys and environment variables
        const envKey = keyName === 'reddit_client_id' ? process.env.REDDIT_CLIENT_ID :
                      keyName === 'reddit_client_secret' ? process.env.REDDIT_CLIENT_SECRET :
                      keyName === 'alpha_vantage_key' ? process.env.ALPHA_VANTAGE_API_KEY :
                      keyName === 'fmp_key' ? process.env.FMP_KEY :
                      keyName === 'finviz_key' ? process.env.FINVIZ_KEY :
                      keyName === 'sec_key' ? process.env.SEC_KEY : null;
        
        keyIsAvailable = !!(userKey || (envKey && envKey.trim()));
      }
      
      keyStatus[keyName] = keyIsAvailable;
    });

    // For data sources that require multiple keys (like Reddit), check that ALL required keys are available
    dataSourceStatus.reddit = keyStatus.reddit_client_id && keyStatus.reddit_client_secret;
    dataSourceStatus.alpha_vantage = keyStatus.alpha_vantage_key;
    dataSourceStatus.fmp = keyStatus.fmp_key;
    dataSourceStatus.finviz = keyStatus.finviz_key;
    dataSourceStatus.sec = keyStatus.sec_key;
    
    res.json({
      success: true,
      keyStatus,
      dataSources: dataSourceStatus,
      userTier: userTier // Include user tier in response for frontend debugging
    });
  } catch (error) {
    console.error('Error fetching API key status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API key status'
    });
  }
});

// POST /api/settings/update-keys
// Updates API keys for the authenticated user
router.post('/update-keys', authenticateToken, async (req, res) => {
  try {
    const { apiKeys } = req.body;
    const userTier = req.user.tier || 'free';
    
    if (!apiKeys || typeof apiKeys !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid API keys data'
      });
    }
    
    // Check for tier restrictions before saving
    if (apiKeys.alpha_vantage_key && userTier === 'free') {
      return res.status(403).json({
        success: false,
        error: 'TIER_RESTRICTION',
        message: 'Alpha Vantage API keys are only available for Pro tier and above',
        userMessage: 'Upgrade to Pro to configure your own Alpha Vantage API key for real-time market data',
        tierRequired: 'pro'
      });
    }
    
    // Save the new keys (this will merge with existing keys)
    const saved = await saveUserApiKeys(req.user.id, apiKeys);
    
    if (saved) {
      res.json({
        success: true,
        message: 'API keys updated successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to save API keys'
      });
    }
  } catch (error) {
    console.error('Error updating API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update API keys'
    });
  }
});

// GET /api/settings/keys
// Returns masked API keys for display (for authenticated user)
router.get('/keys', authenticateToken, async (req, res) => {
  try {
    const apiKeys = await loadUserApiKeys(req.user.id);
    
    // Mask the keys for security before sending to frontend
    const maskedKeys = {};
    Object.keys(apiKeys).forEach(keyName => {
      maskedKeys[keyName] = apiKeys[keyName] ? maskApiKey(apiKeys[keyName]) : '';
    });
    
    res.json({
      success: true,
      keys: maskedKeys
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API keys'
    });
  }
});

// GET /api/settings/keys-unmasked
// Returns actual unmasked API keys for viewing (for authenticated user)
router.get('/keys-unmasked', authenticateToken, async (req, res) => {
  try {
    const apiKeys = await loadUserApiKeys(req.user.id);
    
    // Return the actual keys without masking
    res.json({
      success: true,
      keys: apiKeys
    });
  } catch (error) {
    console.error('Error fetching unmasked API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API keys'
    });
  }
});

module.exports = router; 