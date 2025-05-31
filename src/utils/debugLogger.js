// utils/debugLogger.js
const DebugLog = require('../models/DebugLog');

// Control debug logging globally
const DEBUG_ENABLED = process.env.NODE_ENV === 'development' || process.env.DEBUG_ENABLED === 'true';

// Configure which components should log (add/remove as needed)
const ENABLED_COMPONENTS = ['Auth', 'API', 'Database', 'Server', 'Routes', 'WebSockets'];

// Optional: Filter out specific message types (to reduce noise)
const FILTERED_MESSAGES = ['Health check', 'Static file request'];

// In-memory cache for "once" logs to avoid duplicate DB writes
const loggedOnceCache = new Set();

/**
 * Main debug function for backend logging
 * @param {string} component - Component name
 * @param {string} message - Log message
 * @param {any} data - Additional data to log
 * @param {Object} options - Logging options
 * @param {string} options.level - Log level ('debug', 'info', 'warn', 'error')
 * @param {boolean} options.once - Only log once per server instance
 * @param {boolean} options.important - Force log even if component is disabled
 * @param {boolean} options.persist - Store in database
 * @param {Object} options.requestInfo - HTTP request information
 * @param {Object} options.session - Session information
 */
async function debug(component, message, data = null, options = {}) {
  const level = options.level || 'debug';
  
  // Skip logging if debugging is disabled or component not enabled
  if (!DEBUG_ENABLED && !options.important) {
    return;
  }
  
  if (!ENABLED_COMPONENTS.includes(component) && !options.important) {
    return;
  }
  
  // Skip filtered messages unless they are marked as important
  if (!options.important && FILTERED_MESSAGES.some(filter => message.includes(filter))) {
    return;
  }
  
  // Handle "once" option using in-memory cache
  if (options.once) {
    const key = `${component}_${message}`;
    if (loggedOnceCache.has(key)) {
      return;
    }
    loggedOnceCache.add(key);
  }
  
  // Format the log message
  const formattedMessage = `[${component}] ${message}`;
  
  // Log to console with appropriate level
  const consoleMethod = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  }[level] || console.log;
  
  if (data !== null && data !== undefined) {
    consoleMethod(formattedMessage, data);
  } else {
    consoleMethod(formattedMessage);
  }
  
  // Persist to database if required
  if (options.persist) {
    try {
      // Create a sanitized data object that can be stored in MongoDB
      const sanitizedData = data ? JSON.parse(JSON.stringify(data)) : null;
      
      const logEntry = new DebugLog({
        component,
        level,
        message,
        data: sanitizedData,
        source: 'backend',
        userId: options.session?.userId,
        sessionId: options.session?.id,
        requestInfo: options.requestInfo,
        timestamp: new Date()
      });
      
      await logEntry.save();
    } catch (error) {
      console.error('Failed to save debug log:', error);
    }
  }
  
  return formattedMessage;
}

// Convenience methods for different log levels
debug.info = (component, message, data, options = {}) => 
  debug(component, message, data, { ...options, level: 'info' });

debug.warn = (component, message, data, options = {}) => 
  debug(component, message, data, { ...options, level: 'warn' });

debug.error = (component, message, data, options = {}) => 
  debug(component, message, data, { ...options, level: 'error', important: true });

// Initialize debug system
function initDebugger() {
  if (!DEBUG_ENABLED) return;
  
  console.log('\n=== Debug System Initialized ===');
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Debug Components: ${ENABLED_COMPONENTS.join(', ')}`);
  console.log(`Filtered Messages: ${FILTERED_MESSAGES.join(', ')}`);
  console.log('================================\n');
}

// Create a middleware that adds debugging to request
function debugMiddleware(req, res, next) {
  if (!DEBUG_ENABLED) return next();
  
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 15);
  
  req.debug = (component, message, data, options = {}) => {
    return debug(component, message, data, {
      ...options,
      requestInfo: {
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      },
      session: req.session
    });
  };
  
  // Log when request is received
  debug('Server', `${req.method} ${req.path}`, { 
    query: req.query,
    headers: req.headers,
    requestId,
    body: req.body ? '(body present)' : undefined
  });
  
  // Log when response is sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    debug('Server', `${req.method} ${req.path} [${res.statusCode}] - ${duration}ms`, { 
      statusCode: res.statusCode,
      requestId,
      responseTime: duration
    });
  });
  
  next();
}

// Export the debug functionality
module.exports = {
  debug,
  initDebugger,
  debugMiddleware,
  DEBUG_ENABLED
};
