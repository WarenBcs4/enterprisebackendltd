const express = require('express');
const router = express.Router();
const { base, TABLES } = require('../config/airtable');
const { authenticateToken } = require('../middleware/auth');

// Get all logistics transactions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { branch_id, date_from, date_to, transaction_type, logistics_category } = req.query;
    
    let filterFormula = '';
    const filters = [];
    
    if (branch_id && branch_id !== 'all') {
      filters.push(`{branch_id} = '${branch_id}'`);
    }
    
    if (date_from) {
      filters.push(`IS_AFTER({transaction_date}, '${date_from}')`);
    }
    
    if (date_to) {
      filters.push(`IS_BEFORE({transaction_date}, '${date_to}')`);
    }
    
    if (transaction_type) {
      filters.push(`{transaction_type} = '${transaction_type}'`);
    }
    
    if (logistics_category) {
      filters.push(`{logistics_category} = '${logistics_category}'`);
    }
    
    if (filters.length > 0) {
      filterFormula = `AND(${filters.join(', ')})`;
    }

    const records = await base(TABLES.LOGISTICS_TRANSACTIONS)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'transaction_date', direction: 'desc' }]
      })
      .all();

    const transactions = records.map(record => ({
      id: record.id,
      transaction_id: record.fields.transaction_id,
      transaction_name: record.fields.transaction_name,
      transaction_type: record.fields.transaction_type,
      amount: record.fields.amount,
      transaction_date: record.fields.transaction_date,
      description: record.fields.description,
      logistics_category: record.fields.logistics_category,
      carrier_vendor: record.fields.carrier_vendor,
      shipment_reference: record.fields.shipment_reference,
      payment_method: record.fields.payment_method,
      status: record.fields.status,
      approval_status: record.fields.approval_status,
      cost_breakdown: record.fields.cost_breakdown,
      reviewed_by: record.fields.reviewed_by,
      notes: record.fields.notes,
      vehicle_id: record.fields.vehicle_id,
      branch_id: record.fields.branch_id,
      package_id: record.fields.package_id,
      trip_id: record.fields.trip_id,
      created_at: record.fields.created_at
    }));

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching logistics transactions:', error);
    res.status(500).json({ error: 'Failed to fetch logistics transactions' });
  }
});

// Create new logistics transaction
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      transaction_name,
      transaction_type,
      amount,
      transaction_date,
      description,
      logistics_category,
      carrier_vendor,
      shipment_reference,
      payment_method,
      status = 'Pending',
      approval_status = 'Pending',
      cost_breakdown,
      reviewed_by,
      notes,
      vehicle_id,
      branch_id,
      package_id,
      trip_id
    } = req.body;

    // Generate transaction ID
    const transaction_id = `LT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const record = await base(TABLES.LOGISTICS_TRANSACTIONS).create({
      transaction_id,
      transaction_name,
      transaction_type,
      amount: parseFloat(amount),
      transaction_date,
      description,
      logistics_category,
      carrier_vendor,
      shipment_reference,
      payment_method,
      status,
      approval_status,
      cost_breakdown: JSON.stringify(cost_breakdown),
      reviewed_by: reviewed_by ? [reviewed_by] : undefined,
      notes,
      vehicle_id: vehicle_id ? [vehicle_id] : undefined,
      branch_id: branch_id ? [branch_id] : undefined,
      package_id: package_id ? [package_id] : undefined,
      trip_id: trip_id ? [trip_id] : undefined,
      created_by: [req.user.id],
      created_at: new Date().toISOString()
    });

    res.status(201).json({
      id: record.id,
      transaction_id: record.fields.transaction_id,
      ...record.fields
    });
  } catch (error) {
    console.error('Error creating logistics transaction:', error);
    res.status(500).json({ error: 'Failed to create logistics transaction' });
  }
});

// Update logistics transaction
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = { ...req.body };
    
    // Handle cost_breakdown JSON
    if (updateFields.cost_breakdown) {
      updateFields.cost_breakdown = JSON.stringify(updateFields.cost_breakdown);
    }
    
    // Handle array fields
    ['reviewed_by', 'vehicle_id', 'branch_id', 'package_id', 'trip_id'].forEach(field => {
      if (updateFields[field]) {
        updateFields[field] = [updateFields[field]];
      }
    });

    const record = await base(TABLES.LOGISTICS_TRANSACTIONS).update(id, updateFields);

    res.json({
      id: record.id,
      ...record.fields
    });
  } catch (error) {
    console.error('Error updating logistics transaction:', error);
    res.status(500).json({ error: 'Failed to update logistics transaction' });
  }
});

// Delete logistics transaction
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await base(TABLES.LOGISTICS_TRANSACTIONS).destroy(id);
    res.json({ message: 'Logistics transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting logistics transaction:', error);
    res.status(500).json({ error: 'Failed to delete logistics transaction' });
  }
});

// Get logistics analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const { branch_id, date_from, date_to } = req.query;
    
    let filterFormula = '';
    const filters = [];
    
    if (branch_id && branch_id !== 'all') {
      filters.push(`{branch_id} = '${branch_id}'`);
    }
    
    if (date_from) {
      filters.push(`IS_AFTER({transaction_date}, '${date_from}')`);
    }
    
    if (date_to) {
      filters.push(`IS_BEFORE({transaction_date}, '${date_to}')`);
    }
    
    if (filters.length > 0) {
      filterFormula = `AND(${filters.join(', ')})`;
    }

    const records = await base(TABLES.LOGISTICS_TRANSACTIONS)
      .select({ filterByFormula: filterFormula })
      .all();

    const analytics = {
      totalTransactions: records.length,
      totalAmount: 0,
      byCategory: {},
      byType: {},
      byStatus: {},
      recentTransactions: []
    };

    records.forEach(record => {
      const amount = record.fields.amount || 0;
      const category = record.fields.logistics_category || 'Other';
      const type = record.fields.transaction_type || 'Other';
      const status = record.fields.status || 'Unknown';

      analytics.totalAmount += amount;
      
      analytics.byCategory[category] = (analytics.byCategory[category] || 0) + amount;
      analytics.byType[type] = (analytics.byType[type] || 0) + amount;
      analytics.byStatus[status] = (analytics.byStatus[status] || 0) + 1;
    });

    // Get recent transactions
    analytics.recentTransactions = records
      .sort((a, b) => new Date(b.fields.transaction_date) - new Date(a.fields.transaction_date))
      .slice(0, 10)
      .map(record => ({
        id: record.id,
        transaction_name: record.fields.transaction_name,
        amount: record.fields.amount,
        transaction_date: record.fields.transaction_date,
        status: record.fields.status
      }));

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching logistics analytics:', error);
    res.status(500).json({ error: 'Failed to fetch logistics analytics' });
  }
});

module.exports = router;