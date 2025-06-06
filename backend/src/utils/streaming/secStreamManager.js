/**
 * SEC Stream Manager - Server-Sent Events streaming for SEC data
 */

const EventEmitter = require('events');

/**
 * Active stream connections management
 */
class StreamManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // connectionId -> connection info
    this.userConnections = new Map(); // userId -> Set of connectionIds
    this.streamIntervals = new Map(); // connectionId -> interval ID
    this.maxConnections = 1000;
    this.connectionTimeout = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Add new streaming connection
   * @param {string} connectionId - Unique connection identifier
   * @param {Object} connectionInfo - Connection details
   */
  addConnection(connectionId, connectionInfo) {
    // Check connection limits
    if (this.connections.size >= this.maxConnections) {
      throw new Error('Maximum concurrent connections exceeded');
    }

    // Check user connection limits
    const userId = connectionInfo.userId;
    const userTier = connectionInfo.userTier || 'free';
    const userLimit = this.getUserConnectionLimit(userTier);
    
    if (this.getUserConnectionCount(userId) >= userLimit) {
      throw new Error(`User connection limit exceeded (${userLimit} for ${userTier} tier)`);
    }

    // Store connection
    this.connections.set(connectionId, {
      ...connectionInfo,
      startTime: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0
    });

    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId).add(connectionId);

    // Set connection timeout
    setTimeout(() => {
      this.removeConnection(connectionId, 'timeout');
    }, this.connectionTimeout);

    this.emit('connectionAdded', connectionId, connectionInfo);
  }

  /**
   * Remove streaming connection
   * @param {string} connectionId - Connection identifier
   * @param {string} reason - Reason for removal
   */
  removeConnection(connectionId, reason = 'unknown') {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Clear any intervals
    const intervalId = this.streamIntervals.get(connectionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.streamIntervals.delete(connectionId);
    }

    // Remove from user connections
    const userId = connection.userId;
    if (this.userConnections.has(userId)) {
      this.userConnections.get(userId).delete(connectionId);
      if (this.userConnections.get(userId).size === 0) {
        this.userConnections.delete(userId);
      }
    }

    // Remove connection
    this.connections.delete(connectionId);

    this.emit('connectionRemoved', connectionId, reason, connection);
  }

  /**
   * Get user connection limit based on tier
   * @param {string} userTier - User's subscription tier
   * @returns {number} - Connection limit
   */
  getUserConnectionLimit(userTier) {
    const limits = {
      'free': 1,
      'pro': 3,
      'premium': 10
    };
    return limits[userTier] || 1;
  }

  /**
   * Get user's current connection count
   * @param {string} userId - User ID
   * @returns {number} - Current connection count
   */
  getUserConnectionCount(userId) {
    return this.userConnections.has(userId) ? this.userConnections.get(userId).size : 0;
  }

  /**
   * Update connection activity
   * @param {string} connectionId - Connection identifier
   */
  updateActivity(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = Date.now();
      connection.messageCount++;
    }
  }

  /**
   * Get connection statistics
   * @returns {Object} - Connection statistics
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userConnections.size,
      connectionsByTier: this.getConnectionsByTier(),
      oldestConnection: this.getOldestConnection(),
      averageConnectionDuration: this.getAverageConnectionDuration()
    };
  }

  /**
   * Get connections grouped by user tier
   * @returns {Object} - Connections by tier
   */
  getConnectionsByTier() {
    const tierCounts = { free: 0, pro: 0, premium: 0 };
    
    for (const connection of this.connections.values()) {
      const tier = connection.userTier || 'free';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    }
    
    return tierCounts;
  }

  /**
   * Get oldest connection info
   * @returns {Object|null} - Oldest connection
   */
  getOldestConnection() {
    let oldest = null;
    let oldestTime = Infinity;

    for (const [connectionId, connection] of this.connections) {
      if (connection.startTime < oldestTime) {
        oldestTime = connection.startTime;
        oldest = { connectionId, ...connection };
      }
    }

    return oldest;
  }

  /**
   * Get average connection duration
   * @returns {number} - Average duration in milliseconds
   */
  getAverageConnectionDuration() {
    if (this.connections.size === 0) return 0;

    const now = Date.now();
    let totalDuration = 0;

    for (const connection of this.connections.values()) {
      totalDuration += now - connection.startTime;
    }

    return totalDuration / this.connections.size;
  }
}

// Global stream manager instance
const streamManager = new StreamManager();

/**
 * Set up SSE headers for streaming response
 * @param {Object} res - Express response object
 * @param {Object} options - SSE options
 */
function setupSSEHeaders(res, options = {}) {
  const {
    retry = 5000,
    cacheControl = 'no-cache'
  } = options;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': cacheControl,
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial setup
  res.write(`retry: ${retry}\n\n`);
}

/**
 * Send SSE message to client
 * @param {Object} res - Express response object
 * @param {string} event - Event type
 * @param {Object} data - Data to send
 * @param {string} id - Optional event ID
 */
function sendSSEMessage(res, event, data, id = null) {
  if (id) {
    res.write(`id: ${id}\n`);
  }
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Send heartbeat message to keep connection alive
 * @param {Object} res - Express response object
 */
function sendHeartbeat(res) {
  sendSSEMessage(res, 'heartbeat', {
    timestamp: new Date().toISOString(),
    status: 'alive'
  });
}

/**
 * Create streaming configuration
 * @param {string} dataType - Type of SEC data to stream
 * @param {Object} params - Stream parameters
 * @param {Object} options - Additional options
 * @returns {Object} - Stream configuration
 */
function createStreamConfig(dataType, params = {}, options = {}) {
  const {
    userId,
    userTier = 'free',
    updateInterval = 30000, // 30 seconds default
    heartbeatInterval = 10000 // 10 seconds default
  } = options;

  // Adjust intervals based on user tier
  const tierAdjustments = {
    'free': { updateMultiplier: 2.0, heartbeatMultiplier: 2.0 },
    'pro': { updateMultiplier: 1.0, heartbeatMultiplier: 1.0 },
    'premium': { updateMultiplier: 0.5, heartbeatMultiplier: 0.5 }
  };

  const adjustment = tierAdjustments[userTier] || tierAdjustments.free;

  return {
    dataType,
    params,
    userId,
    userTier,
    updateInterval: Math.round(updateInterval * adjustment.updateMultiplier),
    heartbeatInterval: Math.round(heartbeatInterval * adjustment.heartbeatMultiplier),
    startTime: Date.now(),
    lastUpdate: null,
    messageCount: 0
  };
}

/**
 * Start streaming SEC data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} dataType - Type of SEC data to stream
 * @param {Function} dataFetcher - Function to fetch data
 * @param {Object} options - Stream options
 */
function startStream(req, res, dataType, dataFetcher, options = {}) {
  const connectionId = generateConnectionId();
  const streamConfig = createStreamConfig(dataType, req.query, {
    userId: req.user?.id,
    userTier: req.user?.tier,
    ...options
  });

  try {
    // Add connection to manager
    streamManager.addConnection(connectionId, {
      ...streamConfig,
      req: {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Set up SSE
    setupSSEHeaders(res, options);

    // Send initial connection message
    sendSSEMessage(res, 'connected', {
      connectionId,
      dataType,
      updateInterval: streamConfig.updateInterval,
      userTier: streamConfig.userTier,
      timestamp: new Date().toISOString()
    }, connectionId);

    // Set up data updates
    const updateInterval = setInterval(async () => {
      try {
        const data = await dataFetcher(streamConfig.params);
        
        sendSSEMessage(res, 'data', {
          dataType,
          data,
          timestamp: new Date().toISOString(),
          messageCount: streamConfig.messageCount++
        });

        streamManager.updateActivity(connectionId);
        streamConfig.lastUpdate = Date.now();

      } catch (error) {
        sendSSEMessage(res, 'error', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }, streamConfig.updateInterval);

    // Set up heartbeat
    const heartbeatInterval = setInterval(() => {
      sendHeartbeat(res);
    }, streamConfig.heartbeatInterval);

    // Store intervals
    streamManager.streamIntervals.set(connectionId, {
      update: updateInterval,
      heartbeat: heartbeatInterval
    });

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(updateInterval);
      clearInterval(heartbeatInterval);
      streamManager.removeConnection(connectionId, 'client_disconnect');
    });

    req.on('error', () => {
      clearInterval(updateInterval);
      clearInterval(heartbeatInterval);
      streamManager.removeConnection(connectionId, 'client_error');
    });

  } catch (error) {
    // Send error and close connection
    sendSSEMessage(res, 'error', {
      error: error.message,
      fatal: true,
      timestamp: new Date().toISOString()
    });
    res.end();
  }
}

/**
 * Broadcast message to specific user connections
 * @param {string} userId - User ID
 * @param {string} event - Event type
 * @param {Object} data - Data to broadcast
 */
function broadcastToUser(userId, event, data) {
  const userConnections = streamManager.userConnections.get(userId);
  if (!userConnections) return;

  for (const connectionId of userConnections) {
    const connection = streamManager.connections.get(connectionId);
    if (connection && connection.res) {
      sendSSEMessage(connection.res, event, data);
    }
  }
}

/**
 * Broadcast message to all connections
 * @param {string} event - Event type
 * @param {Object} data - Data to broadcast
 * @param {Object} filter - Optional filter criteria
 */
function broadcastToAll(event, data, filter = {}) {
  for (const [connectionId, connection] of streamManager.connections) {
    // Apply filters
    if (filter.dataType && connection.dataType !== filter.dataType) continue;
    if (filter.userTier && connection.userTier !== filter.userTier) continue;
    
    if (connection.res) {
      sendSSEMessage(connection.res, event, data);
    }
  }
}

/**
 * Generate unique connection ID
 * @returns {string} - Unique connection ID
 */
function generateConnectionId() {
  return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get stream health status
 * @returns {Object} - Stream health information
 */
function getStreamHealth() {
  const stats = streamManager.getStats();
  const now = Date.now();

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connections: {
      total: stats.totalConnections,
      byTier: stats.connectionsByTier,
      uniqueUsers: stats.uniqueUsers
    },
    performance: {
      averageDuration: stats.averageConnectionDuration,
      oldestConnection: stats.oldestConnection ? {
        duration: now - stats.oldestConnection.startTime,
        userTier: stats.oldestConnection.userTier
      } : null
    },
    limits: {
      maxConnections: streamManager.maxConnections,
      utilizationPercent: (stats.totalConnections / streamManager.maxConnections) * 100
    }
  };
}

/**
 * Close all connections for maintenance
 * @param {string} reason - Reason for closing connections
 */
function closeAllConnections(reason = 'maintenance') {
  const message = {
    type: 'shutdown',
    reason,
    timestamp: new Date().toISOString(),
    reconnectDelay: 30000 // Suggest 30 second delay before reconnecting
  };

  // Broadcast shutdown message
  broadcastToAll('shutdown', message);

  // Close all connections
  for (const connectionId of streamManager.connections.keys()) {
    streamManager.removeConnection(connectionId, reason);
  }
}

module.exports = {
  StreamManager,
  streamManager,
  setupSSEHeaders,
  sendSSEMessage,
  sendHeartbeat,
  createStreamConfig,
  startStream,
  broadcastToUser,
  broadcastToAll,
  generateConnectionId,
  getStreamHealth,
  closeAllConnections
}; 