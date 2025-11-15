const express = require('express');
const { airtableHelpers, TABLES } = require('../config/airtable');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const allSales = await airtableHelpers.find(TABLES.SALES);
    res.json(allSales);
  } catch (error) {
    console.error('Get all sales error:', error);
    res.status(500).json({ message: 'Failed to fetch sales' });
  }
});

router.get('/branch/:branchId', async (req, res) => {
  try {
    const { branchId } = req.params;
    const allSales = await airtableHelpers.find(TABLES.SALES);
    const branchSales = allSales.filter(sale => 
      sale.branch_id && sale.branch_id.includes(branchId)
    );
    
    // Get sale items for each sale
    const salesWithItems = await Promise.all(
      branchSales.map(async (sale) => {
        try {
          const saleItems = await airtableHelpers.find(
            TABLES.SALE_ITEMS,
            `{sale_id} = "${sale.id}"`
          );
          return { ...sale, items: saleItems };
        } catch (error) {
          return { ...sale, items: [] };
        }
      })
    );
    
    res.json(salesWithItems);
  } catch (error) {
    console.error('Get branch sales error:', error);
    res.status(500).json({ message: 'Failed to fetch branch sales' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { items, branchId, total_amount } = req.body;

    // Handle new format with items array
    if (items && items.length > 0 && branchId) {
      // Calculate total amount for the sale
      const saleTotal = items.reduce((sum, item) => {
        return sum + (parseInt(item.quantity) * parseFloat(item.unit_price));
      }, 0);
      
      // Create minimal sale record
      const salesData = {
        branch_id: [branchId],
        total_amount: saleTotal
      };
      
      const newSale = await airtableHelpers.create(TABLES.SALES, salesData);
      return res.status(201).json(newSale);
    }
    
    // Fallback minimal sale
    const salesData = {
      branch_id: [branchId],
      total_amount: total_amount || 0
    };

    const newSale = await airtableHelpers.create(TABLES.SALES, salesData);
    res.status(201).json(newSale);
  } catch (error) {
    console.error('Add sale error:', error);
    res.status(500).json({ message: 'Failed to add sale', error: error.message });
  }
});

router.put('/:saleId', async (req, res) => {
  try {
    const { saleId } = req.params;
    const updateData = {
      ...req.body,
      updated_at: new Date().toISOString()
    };

    const updatedSale = await airtableHelpers.update(TABLES.SALES, saleId, updateData);
    res.json(updatedSale);
  } catch (error) {
    console.error('Update sale error:', error);
    res.status(500).json({ message: 'Failed to update sale' });
  }
});

router.delete('/:saleId', async (req, res) => {
  try {
    const { saleId } = req.params;
    await airtableHelpers.delete(TABLES.SALES, saleId);
    res.json({ message: 'Sale deleted successfully' });
  } catch (error) {
    console.error('Delete sale error:', error);
    res.status(500).json({ message: 'Failed to delete sale' });
  }
});

module.exports = router;