const Airtable = require('airtable');

Airtable.configure({
  endpointUrl: 'https://api.airtable.com',
  apiKey: process.env.AIRTABLE_API_KEY
});

const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

// Table names mapping (exact match with Airtable - lowercase)
const TABLES = {
  BRANCHES: 'branches',
  EMPLOYEES: 'employees',
  STOCK: 'stock',
  STOCK_MOVEMENTS: 'stock_movements',
  SALES: 'sales',
  SALE_ITEMS: 'sale_items',
  EXPENSES: 'expenses',
  VEHICLES: 'vehicles',
  TRIPS: 'trips',
  VEHICLE_MAINTENANCE: 'vehicle_maintenance',
  ORDERS: 'orders',
  ORDER_ITEMS: 'order_items',
  PAYROLL: 'payroll',
  AUDIT_LOGS: 'audit_logs',
  ERP_SETTINGS: 'erp_settings',
  DOCUMENTS: 'documents'
};

// Helper functions for Airtable operations
const airtableHelpers = {
  // Create record
  async create(tableName, fields) {
    try {
      const records = await base(tableName).create([{ fields }]);
      return records[0];
    } catch (error) {
      throw new Error(`Airtable create error: ${error.message}`);
    }
  },

  // Find records with filter
  async find(tableName, filterFormula, sort) {
    try {
      const selectOptions = {};
      
      if (filterFormula && typeof filterFormula === 'string' && filterFormula.trim()) {
        selectOptions.filterByFormula = filterFormula;
      }
      if (sort && Array.isArray(sort) && sort.length > 0) {
        selectOptions.sort = sort;
      }
      
      const records = await base(tableName).select(selectOptions).all();
      return records.map(record => ({
        id: record.id,
        ...record.fields
      }));
    } catch (error) {
      throw new Error(`Airtable find error: ${error.message}`);
    }
  },

  // Update record
  async update(tableName, recordId, fields) {
    try {
      const records = await base(tableName).update([{
        id: recordId,
        fields: fields
      }]);
      return records[0];
    } catch (error) {
      throw new Error(`Airtable update error: ${error.message}`);
    }
  },

  // Delete record
  async delete(tableName, recordId) {
    try {
      const records = await base(tableName).destroy([recordId]);
      return records[0];
    } catch (error) {
      throw new Error(`Airtable delete error: ${error.message}`);
    }
  },

  // Get record by ID
  async findById(tableName, recordId) {
    try {
      const record = await base(tableName).find(recordId);
      return {
        id: record.id,
        ...record.fields
      };
    } catch (error) {
      throw new Error(`Airtable findById error: ${error.message}`);
    }
  }
};

module.exports = {
  base,
  TABLES,
  airtableHelpers
};