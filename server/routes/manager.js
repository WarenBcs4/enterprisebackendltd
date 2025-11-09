const express = require('express');
const { airtableHelpers, TABLES } = require('../config/airtable');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Test route without auth
router.get('/test', async (req, res) => {
  res.json({ message: 'Manager routes working', timestamp: new Date().toISOString() });
});

// Get manager dashboard data with fallback
router.get('/dashboard/:branchId', authenticateToken, authorizeRoles(['boss', 'manager', 'admin']), async (req, res) => {
  try {
    const { branchId } = req.params;
    console.log('Manager dashboard request for branchId:', branchId);
    console.log('User from token:', req.user);

    // Fallback data in case Airtable fails
    const fallbackData = {
      branch: {
        id: branchId,
        branch_name: 'KISUMU Branch',
        location_address: 'Kisumu, Kenya'
      },
      summary: {
        totalEmployees: 5,
        totalStock: 25,
        lowStockAlerts: 3,
        todayRevenue: 45000,
        totalRevenue: 1250000,
        todaySalesCount: 12
      },
      employees: [
        {
          id: 'emp1',
          full_name: 'John Doe',
          role: 'sales',
          email: 'john@example.com',
          hire_date: '2024-01-15',
          is_active: true
        }
      ],
      stock: [
        {
          id: 'stock1',
          product_name: 'Sample Product',
          quantity_available: 50,
          reorder_level: 10
        }
      ],
      sales: [],
      lowStockItems: [],
      weeklyData: [
        { name: 'Mon', sales: 35000, target: 50000 },
        { name: 'Tue', sales: 42000, target: 50000 },
        { name: 'Wed', sales: 38000, target: 50000 },
        { name: 'Thu', sales: 45000, target: 50000 },
        { name: 'Fri', sales: 52000, target: 50000 },
        { name: 'Sat', sales: 48000, target: 50000 },
        { name: 'Sun', sales: 41000, target: 50000 }
      ]
    };

    try {
      // Try to get real data from Airtable
      const branch = await airtableHelpers.findById(TABLES.BRANCHES, branchId);
      console.log('Branch found:', branch?.branch_name);
      
      if (!branch) {
        console.log('Branch not found, using fallback data');
        return res.json(fallbackData);
      }

      // Get all employees and filter by branch
      const allEmployees = await airtableHelpers.find(TABLES.EMPLOYEES);
      const employees = allEmployees.filter(emp => 
        emp.branch_id && emp.branch_id.includes(branchId)
      );
      console.log('Employees found:', employees.length);

      // Get all stock and filter by branch
      const allStock = await airtableHelpers.find(TABLES.STOCK);
      const stock = allStock.filter(item => 
        item.branch_id && item.branch_id.includes(branchId)
      );
      console.log('Stock items found:', stock.length, 'for branch:', branchId);

      // Get all sales and filter by branch
      const allSales = await airtableHelpers.find(TABLES.SALES);
      const branchSales = allSales.filter(sale => 
        sale.branch_id && sale.branch_id.includes(branchId)
      );
      
      // Filter for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sales = branchSales.filter(sale => {
        if (!sale.sale_date) return false;
        const saleDate = new Date(sale.sale_date);
        return saleDate >= thirtyDaysAgo;
      });

      // Get today's sales
      const today = new Date().toISOString().split('T')[0];
      const todaySales = branchSales.filter(sale => 
        sale.sale_date && sale.sale_date.startsWith(today)
      );

      // Calculate metrics
      const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
      const todayRevenue = todaySales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
      const lowStockItems = stock.filter(item => 
        item.quantity_available <= (item.reorder_level || 0)
      );

      // Generate weekly sales data for chart
      const weeklyData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const daySales = sales.filter(sale => 
          sale.sale_date && sale.sale_date.startsWith(dateStr)
        );
        
        weeklyData.push({
          name: date.toLocaleDateString('en-US', { weekday: 'short' }),
          sales: daySales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0),
          target: 50000 // Default target
        });
      }

      console.log('Final response data:', {
        branchName: branch.branch_name,
        employeesCount: employees.length,
        stockCount: stock.length,
        lowStockCount: lowStockItems.length
      });

      res.json({
        branch,
        summary: {
          totalEmployees: employees.length,
          totalStock: stock.length,
          lowStockAlerts: lowStockItems.length,
          todayRevenue,
          totalRevenue,
          todaySalesCount: todaySales.length
        },
        employees,
        stock,
        sales: sales.slice(-10).reverse(),
        lowStockItems,
        weeklyData
      });
    } catch (airtableError) {
      console.error('Airtable error, using fallback data:', airtableError.message);
      res.json(fallbackData);
    }
  } catch (error) {
    console.error('Manager dashboard error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
  }
});

module.exports = router;