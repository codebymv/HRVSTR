const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Path to store API keys (in production, use a proper database or secure storage)
const API_KEYS_FILE = path.join(__dirname, '../config/api-keys.json');

// Ensure config directory exists
const ensureConfigDir = async () => {
  const configDir = path.dirname(API_KEYS_FILE);
  try {
    await fs.access(configDir);
  } catch (error) {
    await fs.mkdir(configDir, { recursive: true });
  }
};

// Load API keys from file
const loadApiKeys = async () => {
  try {
    await ensureConfigDir();
    const data = await fs.readFile(API_KEYS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or is invalid, return empty object
    return {};
  }
};

// Save API keys to file
const saveApiKeys = async (keys) => {
  try {
    await ensureConfigDir();
    await fs.writeFile(API_KEYS_FILE, JSON.stringify(keys, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving API keys:', error);
    return false;
  }
};

// GET /api/settings/key-status
// Returns the status of configured API keys
router.get('/key-status', async (req, res) => {
  try {
    const apiKeys = await loadApiKeys();
    
    // Check which keys are configured (have non-empty values)
    const keyStatus = {};
    const dataSourceStatus = {};
    
    // Define expected API keys and their related data sources
    const expectedKeys = {
      'reddit_client_id': 'reddit',
      'reddit_client_secret': 'reddit',
      'alpha_vantage_key': 'alpha_vantage',
      'finviz_key': 'finviz',
      'sec_key': 'sec'
    };
    
    // Check status of each expected key
    Object.keys(expectedKeys).forEach(keyName => {
      keyStatus[keyName] = !!(apiKeys[keyName] && apiKeys[keyName].trim());
      const dataSource = expectedKeys[keyName];
      dataSourceStatus[dataSource] = keyStatus[keyName];
    });
    
    res.json({
      success: true,
      keys: keyStatus,
      dataSources: dataSourceStatus
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
// Updates API keys on the server
router.post('/update-keys', async (req, res) => {
  try {
    const { apiKeys } = req.body;
    
    if (!apiKeys || typeof apiKeys !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid API keys data'
      });
    }
    
    // Load existing keys
    const existingKeys = await loadApiKeys();
    
    // Update with new keys (only update provided keys, keep existing ones)
    const updatedKeys = { ...existingKeys, ...apiKeys };
    
    // Save updated keys
    const saved = await saveApiKeys(updatedKeys);
    
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
// Returns the actual API keys (for internal use only - should be protected in production)
router.get('/keys', async (req, res) => {
  try {
    const apiKeys = await loadApiKeys();
    res.json({
      success: true,
      keys: apiKeys
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API keys'
    });
  }
});

module.exports = router; 