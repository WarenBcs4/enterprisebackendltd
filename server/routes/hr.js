const express = require('express');
const { airtableHelpers, TABLES } = require('../config/airtable');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get all employees
router.get('/employees', async (req, res) => {
  try {
    const employees = await airtableHelpers.find(TABLES.EMPLOYEES);
    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'Failed to fetch employees' });
  }
});

// Create employee
router.post('/employees', async (req, res) => {
  try {
    const employeeData = {
      ...req.body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const newEmployee = await airtableHelpers.create(TABLES.EMPLOYEES, employeeData);
    res.status(201).json(newEmployee);
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Failed to create employee' });
  }
});

// Update employee
router.put('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updated_at: new Date().toISOString()
    };
    
    const updatedEmployee = await airtableHelpers.update(TABLES.EMPLOYEES, id, updateData);
    res.json(updatedEmployee);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ message: 'Failed to update employee' });
  }
});

// Delete employee
router.delete('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await airtableHelpers.delete(TABLES.EMPLOYEES, id);
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Failed to delete employee' });
  }
});

// Get payroll records
router.get('/payroll', async (req, res) => {
  try {
    const payroll = await airtableHelpers.find(TABLES.PAYROLL);
    res.json(payroll);
  } catch (error) {
    console.error('Get payroll error:', error);
    res.status(500).json({ message: 'Failed to fetch payroll' });
  }
});

// Create payroll record
router.post('/payroll', async (req, res) => {
  try {
    const payrollData = {
      ...req.body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const newPayroll = await airtableHelpers.create(TABLES.PAYROLL, payrollData);
    res.status(201).json(newPayroll);
  } catch (error) {
    console.error('Create payroll error:', error);
    res.status(500).json({ message: 'Failed to create payroll record' });
  }
});

module.exports = router;