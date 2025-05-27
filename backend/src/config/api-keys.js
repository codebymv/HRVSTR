// This file provides a centralized way to access API keys
// It prioritizes environment variables but can be updated with user-provided keys

let redditClientId = process.env.REDDIT_CLIENT_ID || '';
let redditClientSecret = process.env.REDDIT_CLIENT_SECRET || '';
let redditUserAgent = process.env.REDDIT_USER_AGENT || 'hrvstr/1.0.0';
let redditUsername = process.env.REDDIT_USERNAME || '';
let redditPassword = process.env.REDDIT_PASSWORD || '';

// Function to update API keys at runtime
function updateApiKeys(keys) {
  if (keys.reddit_client_id) redditClientId = keys.reddit_client_id;
  if (keys.reddit_client_secret) redditClientSecret = keys.reddit_client_secret;
  if (keys.reddit_user_agent) redditUserAgent = keys.reddit_user_agent;
  if (keys.reddit_username) redditUsername = keys.reddit_username;
  if (keys.reddit_password) redditPassword = keys.reddit_password;
  
  console.log('API keys updated');
}

// Export getters to avoid direct access to the variables
module.exports = {
  getRedditClientId: () => redditClientId,
  getRedditClientSecret: () => redditClientSecret,
  getRedditUserAgent: () => redditUserAgent,
  getRedditUsername: () => redditUsername,
  getRedditPassword: () => redditPassword,
  updateApiKeys
};
