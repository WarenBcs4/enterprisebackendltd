const crypto = require('crypto');

// Simple CSRF token generation and validation
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// CSRF protection middleware
const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET requests (read-only operations)
  if (req.method === 'GET') {
    return next();
  }
  
  // Skip CSRF in development if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_CSRF === 'true') {
    return next();
  }
  
  // Check for CSRF token in headers or body
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  
  if (!token) {
    return res.status(403).json({ 
      message: 'CSRF token required',
      code: 'CSRF_TOKEN_MISSING'
    });
  }
  
  // In production, validate token against session
  // For now, just check if token exists and is valid format
  if (token.length !== 64 || !/^[a-f0-9]+$/.test(token)) {
    return res.status(403).json({ 
      message: 'Invalid CSRF token',
      code: 'CSRF_TOKEN_INVALID'
    });
  }
  
  next();
};

// Generate CSRF token endpoint
const getCSRFToken = (req, res) => {
  const token = generateCSRFToken();
  res.json({ csrfToken: token });
};

module.exports = {
  csrfProtection,
  generateCSRFToken,
  getCSRFToken
};