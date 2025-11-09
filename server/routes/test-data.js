const express = require('express');
const { airtableHelpers, TABLES } = require('../config/airtable');
const router = express.Router();

// Test data retrieval from all tables
router.get('/all', async (req, res) => {
  try {
    const results = {};
    
    // Test Employees table
    try {
      const employees = await airtableHelpers.find(TABLES.EMPLOYEES);
      results.employees = {
        status: 'success',
        count: employees.length,
        sample: employees.slice(0, 2).map(emp => ({
          id: emp.id,
          email: emp.email,
          full_name: emp.full_name,
          role: emp.role,
          has_password: !!emp.password_hash
        }))
      };
    } catch (error) {
      results.employees = { status: 'error', error: error.message };
    }
    
    // Test Branches table
    try {
      const branches = await airtableHelpers.find(TABLES.BRANCHES);
      results.branches = {
        status: 'success',
        count: branches.length,
        sample: branches.slice(0, 2).map(branch => ({
          id: branch.id,
          branch_name: branch.branch_name,
          location_address: branch.location_address
        }))
      };
    } catch (error) {
      results.branches = { status: 'error', error: error.message };
    }
    
    // Test Stock table
    try {
      const stock = await airtableHelpers.find(TABLES.STOCK);
      results.stock = {
        status: 'success',
        count: stock.length,
        sample: stock.slice(0, 2).map(item => ({
          id: item.id,
          product_name: item.product_name,
          quantity_available: item.quantity_available
        }))
      };
    } catch (error) {
      results.stock = { status: 'error', error: error.message };
    }
    
    res.json({
      status: 'success',
      message: 'Data retrieval test completed',
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test specific employee login
router.get('/employees/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const Airtable = require('airtable');
    Airtable.configure({
      endpointUrl: 'https://api.airtable.com',
      apiKey: process.env.AIRTABLE_API_KEY
    });
    const base = Airtable.base(process.env.AIRTABLE_BASE_ID);
    
    const records = await base('Employees').select({
      filterByFormula: `{email} = '${email}'`
    }).all();
    
    if (records.length === 0) {
      return res.json({
        status: 'not_found',
        message: 'No employee found with this email',
        email: email
      });
    }
    
    const employee = records[0];
    res.json({
      status: 'found',
      employee: {
        id: employee.id,
        email: employee.fields.email,
        full_name: employee.fields.full_name,
        role: employee.fields.role,
        is_active: employee.fields.is_active,
        has_password: !!employee.fields.password_hash,
        branch_id: employee.fields.branch_id
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;