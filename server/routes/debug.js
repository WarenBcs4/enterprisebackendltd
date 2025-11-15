const express = require('express');
const { airtableHelpers, TABLES } = require('../config/airtable');

const router = express.Router();

// Debug endpoint to check table structure
router.get('/tables/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const tableKey = tableName.toUpperCase();
    
    if (!TABLES[tableKey]) {
      return res.status(404).json({ message: 'Table not found' });
    }
    
    // Get a few records to see the structure
    const records = await airtableHelpers.find(TABLES[tableKey]);
    const sampleRecord = records[0] || {};
    
    res.json({
      tableName: TABLES[tableKey],
      recordCount: records.length,
      sampleFields: Object.keys(sampleRecord),
      sampleRecord: sampleRecord
    });
  } catch (error) {
    console.error('Debug table error:', error);
    res.status(500).json({ message: 'Failed to inspect table', error: error.message });
  }
});

module.exports = router;