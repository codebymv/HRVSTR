/**
 * Python Service Manager
 * Manages the lifecycle of the Python sentiment analysis service
 */
const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');

class PythonServiceManager {
  constructor() {
    this.pythonProcess = null;
    this.isStarting = false;
    this.isHealthy = false;
    this.maxRetries = 3;
    this.retryCount = 0;
    this.healthCheckInterval = null;
    this.startupTimeout = 120000; // 2 minutes for model loading
    
    // Python service configuration
    this.pythonServicePath = path.join(__dirname, '../../../python-sentiment-service');
    this.pythonServiceUrl = 'http://localhost:5000';
    this.startScript = 'start.py';
  }

  /**
   * Start the Python sentiment service
   */
  async startService() {
    if (this.isStarting || this.pythonProcess) {
      console.log('🐍 Python service is already starting or running');
      return;
    }

    this.isStarting = true;
    console.log('🐍 Starting Python sentiment service...');

    try {
      // Start the Python process
      this.pythonProcess = spawn('python', [this.startScript], {
        cwd: this.pythonServicePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      // Handle process output
      this.pythonProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log(`🐍 Python Service: ${output}`);
        }
      });

      this.pythonProcess.stderr.on('data', (data) => {
        const error = data.toString().trim();
        if (error && !error.includes('WARNING')) {
          console.error(`🐍 Python Service Error: ${error}`);
        }
      });

      // Handle process exit
      this.pythonProcess.on('exit', (code, signal) => {
        console.log(`🐍 Python service exited with code ${code} and signal ${signal}`);
        this.cleanup();
        
        // Auto-restart if not intentionally stopped
        if (code !== 0 && this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.log(`🐍 Attempting to restart Python service (attempt ${this.retryCount}/${this.maxRetries})`);
          setTimeout(() => this.startService(), 5000);
        }
      });

      this.pythonProcess.on('error', (error) => {
        console.error('🐍 Failed to start Python service:', error.message);
        this.cleanup();
      });

      // Wait for service to be ready
      await this.waitForServiceReady();
      
      this.isStarting = false;
      this.retryCount = 0;
      console.log('✅ Python sentiment service started successfully');
      
      // Start health monitoring
      this.startHealthMonitoring();
      
    } catch (error) {
      console.error('🐍 Error starting Python service:', error.message);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Wait for the Python service to be ready
   */
  async waitForServiceReady() {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds
    
    while (Date.now() - startTime < this.startupTimeout) {
      try {
        const response = await axios.get(`${this.pythonServiceUrl}/health`, {
          timeout: 5000
        });
        
        if (response.status === 200 && response.data.status === 'healthy') {
          this.isHealthy = true;
          return true;
        }
      } catch (error) {
        // Service not ready yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error('Python service failed to start within timeout period');
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const response = await axios.get(`${this.pythonServiceUrl}/health`, {
          timeout: 5000
        });
        
        this.isHealthy = response.status === 200 && response.data.status === 'healthy';
        
        if (!this.isHealthy) {
          console.warn('🐍 Python service health check failed');
        }
      } catch (error) {
        this.isHealthy = false;
        console.warn('🐍 Python service health check failed:', error.message);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop the Python service
   */
  async stopService() {
    console.log('🐍 Stopping Python sentiment service...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.pythonProcess) {
      this.pythonProcess.kill('SIGTERM');
      
      // Force kill after 10 seconds if not stopped gracefully
      setTimeout(() => {
        if (this.pythonProcess && !this.pythonProcess.killed) {
          console.log('🐍 Force killing Python service...');
          this.pythonProcess.kill('SIGKILL');
        }
      }, 10000);
    }
    
    this.cleanup();
  }

  /**
   * Clean up process references
   */
  cleanup() {
    this.pythonProcess = null;
    this.isStarting = false;
    this.isHealthy = false;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: !!this.pythonProcess && !this.pythonProcess.killed,
      isStarting: this.isStarting,
      isHealthy: this.isHealthy,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      serviceUrl: this.pythonServiceUrl
    };
  }

  /**
   * Check if service is available
   */
  async checkServiceHealth() {
    try {
      const response = await axios.get(`${this.pythonServiceUrl}/health`, {
        timeout: 5000
      });
      return response.status === 200 && response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
const pythonServiceManager = new PythonServiceManager();

module.exports = pythonServiceManager;