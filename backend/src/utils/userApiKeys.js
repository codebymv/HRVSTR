const { pool } = require('../config/data-sources');

/**
 * Load API keys for a specific user from database
 * @param {string} userId - User ID to load keys for
 * @returns {Promise<Object>} Object containing user's API keys
 */
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
                             `${row.provider}_${row.key_name}`}`;
      keys[keyIdentifier] = row.key_value;
    });
    
    return keys;
  } catch (error) {
    console.error('Error loading user API keys:', error);
    return {};
  }
};

/**
 * Get effective API key for a user, falling back to environment variables
 * @param {string} userId - User ID
 * @param {string} provider - Provider name (alpha_vantage, reddit, etc.)
 * @param {string} keyType - Key type (api_key, client_id, etc.)
 * @returns {Promise<string|null>} The effective API key
 */
const getEffectiveApiKey = async (userId, provider, keyType = 'api_key') => {
  try {
    // First try to get user-specific key
    const userKeys = await loadUserApiKeys(userId);
    const keyIdentifier = provider === 'alpha_vantage' ? 'alpha_vantage_key' :
                         provider === 'reddit' && keyType === 'client_id' ? 'reddit_client_id' :
                         provider === 'reddit' && keyType === 'client_secret' ? 'reddit_client_secret' :
                         `${provider}_${keyType}`;
    
    const userKey = userKeys[keyIdentifier];
    if (userKey && userKey.trim()) {
      return userKey.trim();
    }
    
    // Fall back to environment variables
    const envKey = provider === 'alpha_vantage' ? process.env.ALPHA_VANTAGE_API_KEY :
                   provider === 'reddit' && keyType === 'client_id' ? process.env.REDDIT_CLIENT_ID :
                   provider === 'reddit' && keyType === 'client_secret' ? process.env.REDDIT_CLIENT_SECRET :
                   process.env[`${provider.toUpperCase()}_${keyType.toUpperCase()}`];
    
    return envKey && envKey.trim() ? envKey.trim() : null;
  } catch (error) {
    console.error('Error getting effective API key:', error);
    return null;
  }
};

/**
 * Check if user has a specific API key configured
 * @param {string} userId - User ID
 * @param {string} provider - Provider name
 * @param {string} keyType - Key type
 * @returns {Promise<boolean>} True if key is available
 */
const hasApiKey = async (userId, provider, keyType = 'api_key') => {
  const key = await getEffectiveApiKey(userId, provider, keyType);
  return !!key;
};

module.exports = {
  loadUserApiKeys,
  getEffectiveApiKey,
  hasApiKey
}; 