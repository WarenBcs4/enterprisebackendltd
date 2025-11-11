const { airtableHelpers, TABLES } = require('../config/airtable');

// Security event logging
const logSecurityEvent = async (req, eventType, details = {}) => {
  try {
    await airtableHelpers.create(TABLES.AUDIT_LOGS, {
      user_id: req.user?.id || 'anonymous',
      action: eventType,
      resource: req.originalUrl,
      method: req.method,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      details: JSON.stringify(details),
      severity: getSeverityLevel(eventType)
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

// Get severity level for different event types
const getSeverityLevel = (eventType) => {
  const severityMap = {
    'LOGIN_FAILED': 'medium',
    'CSRF_VIOLATION': 'high',
    'RATE_LIMIT_EXCEEDED': 'medium',
    'UNAUTHORIZED_ACCESS': 'high',
    'SUSPICIOUS_ACTIVITY': 'high',
    'LOGIN_SUCCESS': 'low',
    'LOGOUT': 'low'
  };
  return severityMap[eventType] || 'low';
};

// Monitor failed login attempts
const monitorFailedLogins = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 401 && req.path.includes('/login')) {
      logSecurityEvent(req, 'LOGIN_FAILED', {
        email: req.body.email,
        reason: 'Invalid credentials'
      });
    }
    originalSend.call(this, data);
  };
  
  next();
};

// Monitor successful logins
const monitorSuccessfulLogins = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 200 && req.path.includes('/login')) {
      logSecurityEvent(req, 'LOGIN_SUCCESS', {
        email: req.body.email,
        user_id: req.user?.id
      });
    }
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  logSecurityEvent,
  monitorFailedLogins,
  monitorSuccessfulLogins
};