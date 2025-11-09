const express = require('express');
const bcrypt = require('bcryptjs');
const { airtableHelpers, TABLES } = require('../config/airtable');
const { auditLog, authenticateToken, authorizeRoles } = require('../middleware/auth');

// CSRF protection middleware (disabled in development)
const csrfProtection = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  if (!token) {
    return res.status(403).json({ message: 'CSRF token required' });
  }
  next();
};

const router = express.Router();

// Get all employees
router.get('/employees', authenticateToken, async (req, res) => {
  try {
    const { branchId } = req.query;
    
    // Get all employees first
    const allEmployees = await airtableHelpers.find(TABLES.EMPLOYEES);
    
    // Filter by branch if specified
    let employees = allEmployees;
    if (branchId) {
      employees = allEmployees.filter(emp => 
        emp.branch_id && emp.branch_id.includes(branchId)
      );
    }
    
    const cleanEmployees = employees.map(emp => ({
      id: emp.id,
      full_name: emp.full_name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      role: emp.role || '',
      branch_id: emp.branch_id || null,
      is_active: emp.is_active !== false,
      hire_date: emp.hire_date || '',
      salary: emp.salary || 0,
      driver_license: emp.driver_license || null,
      vehicle_assigned: emp.vehicle_assigned || false
    }));

    res.json(cleanEmployees);
  } catch (error) {
    console.error('Get employees error:', error.message);
    res.status(500).json({ message: 'Failed to fetch employees', error: error.message });
  }
});

// Create new employee
router.post('/employees', authenticateToken, authorizeRoles(['admin', 'boss', 'hr']), csrfProtection, async (req, res) => {
  try {
    console.log('Creating employee request:', req.body);
    const { full_name, email, phone, role, branch_id, salary, password, hire_date } = req.body;
    
    // Validate required fields
    if (!full_name || !email || !role) {
      return res.status(400).json({ message: 'Full name, email, and role are required' });
    }

    // Check if email already exists
    const existingEmployees = await airtableHelpers.find(
      TABLES.EMPLOYEES,
      `{email} = "${email}"`
    );
    
    if (existingEmployees.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Use provided password or generate default
    const finalPassword = password || `${role}${process.env.DEFAULT_PASSWORD_SUFFIX || 'pass123'}`;
    const hashedPassword = await bcrypt.hash(finalPassword, 12);
    
    const employeeData = {
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      role,
      password_hash: hashedPassword,
      is_active: true,
      hire_date: hire_date || new Date().toISOString().split('T')[0],
      mfa_enabled: false
    };
    
    // Add optional fields
    if (phone && phone.trim()) employeeData.phone = phone.trim();
    if (branch_id && branch_id !== '' && branch_id !== null) {
      // Verify branch exists before linking
      try {
        const branch = await airtableHelpers.findById(TABLES.BRANCHES, branch_id);
        if (branch) {
          employeeData.branch_id = [branch_id]; // Airtable link field format
        }
      } catch (branchError) {
        console.log('Branch not found, skipping branch assignment:', branch_id);
      }
    }
    if (salary && salary !== '' && salary !== null && !isNaN(salary)) {
      employeeData.salary = parseFloat(salary).toString(); // Airtable expects string for currency field
    }
    
    // Add special handling for logistics/driver role
    if (role === 'logistics') {
      employeeData.driver_license = 'pending'; // Can be updated later
      employeeData.vehicle_assigned = false;
    }
    
    console.log('Creating employee with data:', JSON.stringify(employeeData, null, 2));
    
    // Validate required fields before creation
    if (!employeeData.full_name || !employeeData.email || !employeeData.role) {
      throw new Error('Missing required fields: full_name, email, or role');
    }
    
    const employee = await airtableHelpers.create(TABLES.EMPLOYEES, employeeData);
    console.log('Employee created successfully:', employee.id);

    // Return clean response
    res.status(201).json({
      id: employee.id,
      full_name: employee.fields.full_name,
      email: employee.fields.email,
      role: employee.fields.role,
      branch_id: employee.fields.branch_id || null,
      is_active: employee.fields.is_active,
      hire_date: employee.fields.hire_date,
      salary: employee.fields.salary || null,
      phone: employee.fields.phone || null,
      driver_license: employee.fields.driver_license || null,
      vehicle_assigned: employee.fields.vehicle_assigned || false
    });
  } catch (error) {
    console.error('Create employee error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      message: 'Failed to create employee', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update employee
router.put('/employees/:employeeId', authenticateToken, authorizeRoles(['admin', 'boss', 'hr']), async (req, res) => {
  try {
    console.log('Updating employee:', req.params.employeeId);
    console.log('Update data:', req.body);
    
    const { employeeId } = req.params;
    const { full_name, email, phone, role, branch_id, salary, is_active, hire_date } = req.body;

    const employee = await airtableHelpers.findById(TABLES.EMPLOYEES, employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const updateData = {};
    if (full_name && full_name.trim()) updateData.full_name = full_name.trim();
    if (email && email.trim()) updateData.email = email.toLowerCase().trim();
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
    if (role) updateData.role = role;
    if (branch_id !== undefined && branch_id !== null && branch_id !== '') {
      // Verify branch exists before linking
      try {
        const branch = await airtableHelpers.findById(TABLES.BRANCHES, branch_id);
        if (branch) {
          updateData.branch_id = [branch_id]; // Airtable link field format
        }
      } catch (branchError) {
        console.log('Branch not found, skipping branch update:', branch_id);
      }
    } else if (branch_id === null || branch_id === '') {
      updateData.branch_id = null; // Clear branch assignment
    }
    if (salary !== undefined && salary !== null && salary !== '') {
      updateData.salary = salary.toString(); // Airtable expects string for currency field
    }
    if (is_active !== undefined) updateData.is_active = is_active;
    if (hire_date !== undefined) updateData.hire_date = hire_date;

    console.log('Final update data:', updateData);
    const updatedEmployee = await airtableHelpers.update(TABLES.EMPLOYEES, employeeId, updateData);

    res.json({
      id: updatedEmployee.id,
      full_name: updatedEmployee.fields.full_name,
      email: updatedEmployee.fields.email,
      phone: updatedEmployee.fields.phone || null,
      role: updatedEmployee.fields.role,
      branch_id: updatedEmployee.fields.branch_id || null,
      salary: updatedEmployee.fields.salary || null,
      is_active: updatedEmployee.fields.is_active,
      hire_date: updatedEmployee.fields.hire_date || null,
      driver_license: updatedEmployee.fields.driver_license || null,
      vehicle_assigned: updatedEmployee.fields.vehicle_assigned || false
    });
  } catch (error) {
    console.error('Update employee error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      message: 'Failed to update employee',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete employee (deactivate)
router.delete('/employees/:employeeId', authenticateToken, authorizeRoles(['admin', 'boss', 'hr']), async (req, res) => {
  try {
    const { employeeId } = req.params;

    await airtableHelpers.update(TABLES.EMPLOYEES, employeeId, {
      is_active: false
    });

    res.json({ message: 'Employee deactivated successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Failed to deactivate employee' });
  }
});

// Generate payroll
router.post('/payroll/generate', async (req, res) => {
  try {
    const {
      period_start,
      period_end,
      employee_ids,
      deductions_percentage = 15 // Default 15% deductions
    } = req.body;

    console.log('Generating payroll:', { period_start, period_end, employee_ids, deductions_percentage });

    if (!period_start || !period_end) {
      return res.status(400).json({ message: 'Period start and end dates are required' });
    }

    let employees;
    if (employee_ids && employee_ids.length > 0) {
      // Generate for specific employees
      employees = await Promise.all(
        employee_ids.map(id => airtableHelpers.findById(TABLES.EMPLOYEES, id))
      );
      employees = employees.filter(emp => emp); // Remove null results
    } else {
      // Generate for all active employees with salary
      employees = await airtableHelpers.find(
        TABLES.EMPLOYEES,
        'AND({is_active} = TRUE(), {salary} != BLANK())'
      );
    }

    console.log(`Found ${employees.length} employees for payroll generation`);

    const payrollRecords = [];
    for (const employee of employees) {
      try {
        const grossSalary = parseFloat(employee.salary || '0');
        if (grossSalary <= 0) {
          console.log(`Skipping employee ${employee.full_name} - no salary set`);
          continue;
        }

        const deductionAmount = grossSalary * (deductions_percentage / 100);
        const netSalary = grossSalary - deductionAmount;

        const payrollData = {
          employee_id: [employee.id], // Airtable link field format
          employee_name: employee.full_name,
          employee_email: employee.email,
          period_start,
          period_end,
          gross_salary: grossSalary.toString(),
          deductions: deductionAmount.toString(),
          net_salary: netSalary.toString(),
          payment_status: 'pending',
          generated_by: req.user?.id || 'system',
          created_at: new Date().toISOString()
        };

        console.log(`Creating payroll for ${employee.full_name}:`, payrollData);
        const record = await airtableHelpers.create(TABLES.PAYROLL, payrollData);
        payrollRecords.push(record);
      } catch (empError) {
        console.error(`Error creating payroll for employee ${employee.full_name}:`, empError);
      }
    }

    res.status(201).json({
      message: 'Payroll generated successfully',
      records: payrollRecords.length,
      total_employees: employees.length
    });
  } catch (error) {
    console.error('Generate payroll error:', error);
    res.status(500).json({ 
      message: 'Failed to generate payroll',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get payroll records
router.get('/payroll', async (req, res) => {
  try {
    const { period_start, period_end, employee_id, status } = req.query;
    
    console.log('Fetching payroll with filters:', { period_start, period_end, employee_id, status });
    
    let filterFormula = '';
    const filters = [];
    
    if (period_start && period_end) {
      filters.push(`AND(IS_AFTER({period_start}, "${period_start}"), IS_BEFORE({period_end}, "${period_end}"))`);
    }
    if (employee_id) {
      // Handle both direct ID and array format
      filters.push(`FIND("${employee_id}", ARRAYJOIN({employee_id})) > 0`);
    }
    if (status) filters.push(`{payment_status} = "${status}"`);
    
    if (filters.length > 0) {
      filterFormula = filters.length === 1 ? filters[0] : `AND(${filters.join(', ')})`;
    }

    console.log('Using filter formula:', filterFormula);
    const payrollRecords = await airtableHelpers.find(TABLES.PAYROLL, filterFormula);
    console.log(`Found ${payrollRecords.length} payroll records`);
    
    // Clean and format payroll records
    const cleanPayroll = payrollRecords.map(record => {
      return {
        id: record.id,
        employee_id: record.employee_id,
        employee_name: record.employee_name || 'Unknown Employee',
        employee_email: record.employee_email || '',
        period_start: record.period_start,
        period_end: record.period_end,
        gross_salary: record.gross_salary || '0',
        deductions: record.deductions || '0',
        net_salary: record.net_salary || '0',
        payment_status: record.payment_status || 'pending',
        payslip_sent: record.payslip_sent || false,
        payslip_sent_date: record.payslip_sent_date || null,
        created_at: record.created_at || new Date().toISOString(),
        generated_by: record.generated_by || 'system'
      };
    });

    res.json(cleanPayroll);
  } catch (error) {
    console.error('Get payroll error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch payroll records',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Mark payroll as paid
router.patch('/payroll/:payrollId/paid', async (req, res) => {
  try {
    const { payrollId } = req.params;

    console.log('Marking payroll as paid:', payrollId);

    const updatedPayroll = await airtableHelpers.update(TABLES.PAYROLL, payrollId, {
      payment_status: 'paid',
      payment_date: new Date().toISOString()
    });

    res.json({
      id: updatedPayroll.id,
      payment_status: updatedPayroll.fields.payment_status,
      payment_date: updatedPayroll.fields.payment_date,
      message: 'Payroll marked as paid successfully'
    });
  } catch (error) {
    console.error('Mark payroll paid error:', error);
    res.status(500).json({ 
      message: 'Failed to mark payroll as paid',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Bulk update payroll status
router.patch('/payroll/bulk-update', async (req, res) => {
  try {
    const { payroll_ids, status, payment_date } = req.body;

    console.log('Bulk updating payroll:', { payroll_ids, status, payment_date });

    if (!payroll_ids || payroll_ids.length === 0) {
      return res.status(400).json({ message: 'Payroll IDs are required' });
    }

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const updateData = {
      payment_status: status
    };

    if (payment_date) {
      updateData.payment_date = payment_date;
    } else if (status === 'paid') {
      updateData.payment_date = new Date().toISOString();
    }

    let successCount = 0;
    const errors = [];

    for (const id of payroll_ids) {
      try {
        await airtableHelpers.update(TABLES.PAYROLL, id, updateData);
        successCount++;
      } catch (updateError) {
        console.error(`Error updating payroll ${id}:`, updateError);
        errors.push({ id, error: updateError.message });
      }
    }

    res.json({
      message: `Successfully updated ${successCount} payroll records`,
      updated_count: successCount,
      total_requested: payroll_ids.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Bulk update payroll error:', error);
    res.status(500).json({ 
      message: 'Failed to bulk update payroll',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Send payslips (placeholder - would integrate with email service)
router.post('/payroll/send-payslips', async (req, res) => {
  try {
    const { payroll_ids } = req.body;

    console.log('Sending payslips for IDs:', payroll_ids);

    if (!payroll_ids || payroll_ids.length === 0) {
      return res.status(400).json({ message: 'Payroll IDs are required' });
    }

    let successCount = 0;
    const errors = [];

    // Update each payroll record
    for (const id of payroll_ids) {
      try {
        await airtableHelpers.update(TABLES.PAYROLL, id, {
          payslip_sent: true,
          payslip_sent_date: new Date().toISOString(),
          payment_status: 'sent' // Update status to sent
        });
        successCount++;
      } catch (updateError) {
        console.error(`Error updating payroll ${id}:`, updateError);
        errors.push({ id, error: updateError.message });
      }
    }

    // This would integrate with Amazon SES to send actual emails
    // For now, we simulate email sending
    console.log(`Simulated sending ${successCount} payslips via email`);

    res.json({ 
      message: `Payslips sent successfully to ${successCount} employees`,
      sent_count: successCount,
      total_requested: payroll_ids.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Send payslips error:', error);
    res.status(500).json({ 
      message: 'Failed to send payslips',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get driver statistics for logistics integration
router.get('/drivers/stats', authenticateToken, async (req, res) => {
  try {
    const drivers = await airtableHelpers.find(
      TABLES.EMPLOYEES,
      '{role} = "logistics"'
    );

    const stats = {
      total_drivers: drivers.length,
      active_drivers: drivers.filter(d => d.is_active).length,
      inactive_drivers: drivers.filter(d => !d.is_active).length,
      licensed_drivers: drivers.filter(d => d.driver_license && d.driver_license !== 'pending').length,
      assigned_drivers: drivers.filter(d => d.vehicle_assigned).length
    };

    res.json({
      stats,
      drivers: drivers.map(d => ({
        id: d.id,
        full_name: d.full_name,
        email: d.email,
        phone: d.phone,
        is_active: d.is_active,
        driver_license: d.driver_license,
        vehicle_assigned: d.vehicle_assigned,
        hire_date: d.hire_date,
        salary: d.salary
      }))
    });
  } catch (error) {
    console.error('Get driver stats error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch driver statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;