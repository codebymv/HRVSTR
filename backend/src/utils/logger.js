/**
 * Simple Logger Utility
 * Provides consistent logging across the application
 */

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    /**
     * Get current timestamp
     */
    getTimestamp() {
        return new Date().toISOString();
    }

    /**
     * Check if log level should be output
     */
    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    /**
     * Format log message
     */
    formatMessage(level, message, ...args) {
        const timestamp = this.getTimestamp();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        
        if (args.length > 0) {
            return [prefix + ' ' + message, ...args];
        }
        return prefix + ' ' + message;
    }

    /**
     * Log error messages
     */
    error(message, ...args) {
        if (this.shouldLog('error')) {
            const formatted = this.formatMessage('error', message, ...args);
            if (Array.isArray(formatted)) {
                console.error(...formatted);
            } else {
                console.error(formatted);
            }
        }
    }

    /**
     * Log warning messages
     */
    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            const formatted = this.formatMessage('warn', message, ...args);
            if (Array.isArray(formatted)) {
                console.warn(...formatted);
            } else {
                console.warn(formatted);
            }
        }
    }

    /**
     * Log info messages
     */
    info(message, ...args) {
        if (this.shouldLog('info')) {
            const formatted = this.formatMessage('info', message, ...args);
            if (Array.isArray(formatted)) {
                console.log(...formatted);
            } else {
                console.log(formatted);
            }
        }
    }

    /**
     * Log debug messages
     */
    debug(message, ...args) {
        if (this.shouldLog('debug')) {
            const formatted = this.formatMessage('debug', message, ...args);
            if (Array.isArray(formatted)) {
                console.log(...formatted);
            } else {
                console.log(formatted);
            }
        }
    }
}

// Export singleton instance
module.exports = new Logger();