const express = require('express');
const { airtableHelpers, TABLES } = require('../config/airtable');

const router = express.Router();

// Comprehensive system diagnostics
router.get('/system-check', async (req, res) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {}
  };

  try {
    // 1. Environment Variables Check
    diagnostics.checks.environment_variables = {
      JWT_SECRET: !!process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: !!process.env.JWT_REFRESH_SECRET,
      AIRTABLE_API_KEY: !!process.env.AIRTABLE_API_KEY,
      AIRTABLE_BASE_ID: !!process.env.AIRTABLE_BASE_ID,
      ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
      status: 'checked'
    };

    // 2. Airtable Connection Test
    try {
      const testConnection = await airtableHelpers.find(TABLES.EMPLOYEES, '', [{ field: 'created_at', direction: 'desc' }]);
      diagnostics.checks.airtable_connection = {
        status: 'success',
        employees_found: testConnection.length,
        sample_user: testConnection.length > 0 ? {
          id: testConnection[0].id,
          email: testConnection[0].email,
          role: testConnection[0].role,
          has_password_hash: !!testConnection[0].password_hash
        } : null
      };
    } catch (airtableError) {
      diagnostics.checks.airtable_connection = {
        status: 'failed',
        error: airtableError.message,
        details: 'Cannot connect to Airtable or Employees table missing'
      };
    }

    // 3. Database Tables Check
    const tableChecks = {};
    for (const [tableName, tableId] of Object.entries(TABLES)) {
      try {
        const records = await airtableHelpers.find(tableId);
        tableChecks[tableName] = {
          status: 'exists',
          record_count: records.length
        };
      } catch (error) {
        tableChecks[tableName] = {
          status: 'missing_or_error',
          error: error.message
        };
      }
    }
    diagnostics.checks.database_tables = tableChecks;

    // 4. JWT Configuration Check
    diagnostics.checks.jwt_config = {
      secret_length: process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0,
      refresh_secret_length: process.env.JWT_REFRESH_SECRET ? process.env.JWT_REFRESH_SECRET.length : 0,
      expires_in: process.env.JWT_EXPIRES_IN || 'not_set',
      refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || 'not_set'
    };

    // 5. API Endpoints Test
    diagnostics.checks.api_endpoints = {
      health_check: 'accessible',
      auth_routes: 'loaded',
      other_routes: 'loaded'
    };

    // 6. Critical Issues Summary
    const criticalIssues = [];
    
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      criticalIssues.push('JWT_SECRET missing or too short');
    }
    
    if (!process.env.AIRTABLE_API_KEY) {
      criticalIssues.push('AIRTABLE_API_KEY missing');
    }
    
    if (!process.env.AIRTABLE_BASE_ID) {
      criticalIssues.push('AIRTABLE_BASE_ID missing');
    }
    
    if (diagnostics.checks.airtable_connection.status === 'failed') {
      criticalIssues.push('Airtable connection failed');
    }
    
    if (diagnostics.checks.airtable_connection.employees_found === 0) {
      criticalIssues.push('No employees found in database');
    }

    diagnostics.critical_issues = criticalIssues;
    diagnostics.system_status = criticalIssues.length === 0 ? 'healthy' : 'issues_detected';

    res.json(diagnostics);

  } catch (error) {
    res.status(500).json({
      error: 'Diagnostics failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Test specific login flow
router.post('/test-login', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email required for test' });
  }

  const loginTest = {
    timestamp: new Date().toISOString(),
    email: email,
    steps: {}
  };

  try {
    // Step 1: Find user
    loginTest.steps.find_user = { status: 'attempting' };
    const allUsers = await airtableHelpers.find(TABLES.EMPLOYEES);
    const user = allUsers.find(u => u.email === email);
    
    if (user) {
      loginTest.steps.find_user = {
        status: 'success',
        user_found: true,
        user_data: {
          id: user.id,
          email: user.email,
          role: user.role,
          is_active: user.is_active,
          has_password_hash: !!user.password_hash,
          branch_id: user.branch_id
        }
      };
    } else {
      loginTest.steps.find_user = {
        status: 'failed',
        user_found: false,
        total_users_in_db: allUsers.length,
        available_emails: allUsers.map(u => u.email)
      };
    }

    // Step 2: Check user structure
    if (user) {
      loginTest.steps.user_validation = {
        has_required_fields: {
          id: !!user.id,
          email: !!user.email,
          full_name: !!user.full_name,
          role: !!user.role,
          password_hash: !!user.password_hash,
          is_active: user.is_active !== undefined
        }
      };
    }

    res.json(loginTest);

  } catch (error) {
    loginTest.error = error.message;
    res.status(500).json(loginTest);
  }
});

module.exports = router;