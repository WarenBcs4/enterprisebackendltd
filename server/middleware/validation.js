const { body, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');

// Input sanitization function
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return DOMPurify.sanitize(input.trim());
  }
  return input;
};

// Validation middleware
const validateAndSanitize = (validations) => {
  return async (req, res, next) => {
    // Run validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }
    
    // Sanitize all string inputs in body
    const sanitizeObject = (obj) => {
      for (let key in obj) {
        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          sanitizeObject(obj[key]);
        } else if (typeof obj[key] === 'string') {
          obj[key] = sanitizeInput(obj[key]);
        }
      }
    };
    
    if (req.body) {
      sanitizeObject(req.body);
    }
    
    next();
  };
};

// Common validation rules
const commonValidations = {
  email: body('email').isEmail().normalizeEmail(),
  password: body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  name: body('full_name').isLength({ min: 2, max: 100 }).trim(),
  amount: body('amount').isFloat({ min: 0 }),
  date: body('*_date').optional().isISO8601(),
  id: body('*_id').optional().isAlphanumeric()
};

module.exports = {
  validateAndSanitize,
  sanitizeInput,
  commonValidations,
  body
};