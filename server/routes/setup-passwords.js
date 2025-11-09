const express = require('express');
const bcrypt = require('bcryptjs');
const { airtableHelpers, TABLES } = require('../config/airtable');
const router = express.Router();

// Setup passwords for employees who don't have them
router.post('/setup-missing-passwords', async (req, res) => {
  try {
    console.log('Setting up missing passwords...');
    
    // Get all employees
    const employees = await airtableHelpers.find(TABLES.EMPLOYEES);
    console.log(`Found ${employees.length} employees`);
    
    const employeesWithoutPasswords = employees.filter(emp => !emp.password_hash);
    console.log(`Found ${employeesWithoutPasswords.length} employees without passwords`);
    
    const updates = [];
    
    for (const employee of employeesWithoutPasswords) {
      if (employee.email && employee.role) {
        // Generate default password: {role}Password123!
        const defaultPassword = `${employee.role}Password123!`;
        const hashedPassword = await bcrypt.hash(defaultPassword, 12);
        
        updates.push({
          id: employee.id,
          email: employee.email,
          role: employee.role,
          defaultPassword: defaultPassword
        });
        
        // Update employee with password
        await airtableHelpers.update(TABLES.EMPLOYEES, employee.id, {
          password_hash: hashedPassword,
          is_active: true,
          updated_at: new Date().toISOString()
        });
        
        console.log(`Set password for ${employee.email} (${employee.role})`);
      }
    }
    
    res.json({
      status: 'success',
      message: `Set up passwords for ${updates.length} employees`,
      updates: updates,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Password setup error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get employees without passwords
router.get('/missing-passwords', async (req, res) => {
  try {
    const employees = await airtableHelpers.find(TABLES.EMPLOYEES);
    const employeesWithoutPasswords = employees.filter(emp => !emp.password_hash);
    
    res.json({
      status: 'success',
      total_employees: employees.length,
      employees_without_passwords: employeesWithoutPasswords.length,
      employees: employeesWithoutPasswords.map(emp => ({
        id: emp.id,
        email: emp.email,
        full_name: emp.full_name,
        role: emp.role,
        is_active: emp.is_active
      })),
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

module.exports = router;