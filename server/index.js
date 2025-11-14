const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const branchRoutes = require('./routes/branches');
const stockRoutes = require('./routes/stock');
const salesRoutes = require('./routes/sales');
const logisticsRoutes = require('./routes/logistics');
const ordersRoutes = require('./routes/orders');
const hrRoutes = require('./routes/hr');
const bossRoutes = require('./routes/boss');
const managerRoutes = require('./routes/manager');
const adminRoutes = require('./routes/admin');
const expensesRoutes = require('./routes/expenses');
const dataRoutes = require('./routes/data');
const { authenticateToken, authorizeRoles } = require('./middleware/auth');

const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (process.env.NODE_ENV === 'production') {
      if (origin.includes('kabisakabisa-enterprise-ltd') && origin.includes('vercel.app')) {
        return callback(null, true);
      }
      const allowedOrigins = [
        'https://kabisakabisa-enterprise-ltd.vercel.app',
        'https://kabisakabisa-enterprise-ltd-j49p.vercel.app',
        'https://kabisakabisa-enterprise-ltd-1osy.vercel.app'
      ];
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    } else {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'BSN Manager Backend API is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0-cleaned',
    routes: {
      stock: 'mounted',
      sales: 'mounted',
      expenses: 'mounted'
    }
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working',
    timestamp: new Date().toISOString(),
    status: 'success'
  });
});

app.get('/api/stock-test', (req, res) => {
  res.json({ 
    message: 'Stock route is accessible',
    timestamp: new Date().toISOString(),
    status: 'success'
  });
});

// Test stock route without auth
app.get('/api/stock/test', (req, res) => {
  res.json({ 
    message: 'Stock routes are working',
    timestamp: new Date().toISOString(),
    status: 'success'
  });
});

// Direct stock routes as fallback
app.get('/api/stock/health', (req, res) => {
  res.json({ 
    message: 'Stock routes are working',
    timestamp: new Date().toISOString(),
    status: 'success'
  });
});

app.get('/api/stock', authenticateToken, async (req, res) => {
  try {
    const { airtableHelpers, TABLES } = require('./config/airtable');
    const allStock = await airtableHelpers.find(TABLES.STOCK);
    res.json(allStock);
  } catch (error) {
    console.error('Get all stock error:', error);
    res.status(500).json({ message: 'Failed to fetch all stock' });
  }
});

app.post('/api/stock', authenticateToken, async (req, res) => {
  try {
    const { airtableHelpers, TABLES } = require('./config/airtable');
    const { branchId, product_name, product_id, quantity_available, unit_price, reorder_level, branch_id } = req.body;
    const targetBranchId = branchId || (Array.isArray(branch_id) ? branch_id[0] : branch_id);

    if (!product_name || !quantity_available || !unit_price) {
      return res.status(400).json({ message: 'Product name, quantity, and unit price are required' });
    }

    if (!targetBranchId) {
      return res.status(400).json({ message: 'Branch ID is required' });
    }

    const stockData = {
      branch_id: [targetBranchId],
      product_id: product_id || `PRD_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      product_name: product_name.trim(),
      quantity_available: parseInt(quantity_available),
      unit_price: parseFloat(unit_price),
      reorder_level: parseInt(reorder_level) || 10,
      last_updated: new Date().toISOString()
    };

    const newStock = await airtableHelpers.create(TABLES.STOCK, stockData);
    res.status(201).json(newStock);
  } catch (error) {
    console.error('Add stock error:', error);
    res.status(500).json({ message: 'Failed to add stock', error: error.message });
  }
});

console.log('Mounting routes...');
app.use('/api/auth', authRoutes);
console.log('Auth routes mounted');
app.use('/api/branches', branchRoutes);
console.log('Branches routes mounted');
app.use('/api/expenses', authenticateToken, expensesRoutes);
console.log('Expenses routes mounted');
// app.use('/api/stock', authenticateToken, stockRoutes);
console.log('Stock routes mounted directly');
app.use('/api/sales', authenticateToken, salesRoutes);
console.log('Sales routes mounted');
app.use('/api/logistics', authenticateToken, logisticsRoutes);
console.log('Logistics routes mounted');
app.use('/api/orders', authenticateToken, ordersRoutes);
console.log('Orders routes mounted');
app.use('/api/hr', authenticateToken, hrRoutes);
console.log('HR routes mounted');
app.use('/api/boss', authenticateToken, authorizeRoles(['boss', 'manager', 'admin']), bossRoutes);
console.log('Boss routes mounted');
app.use('/api/manager', authenticateToken, managerRoutes);
console.log('Manager routes mounted');
app.use('/api/admin', authenticateToken, adminRoutes);
console.log('Admin routes mounted');
app.use('/api/data', authenticateToken, dataRoutes);
console.log('Data routes mounted');
console.log('All routes mounted successfully');

app.use((err, req, res, next) => {
  res.status(500).json({ 
    message: 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

app.use('*', (req, res) => {
  console.log('404 - Route not found:', req.method, req.originalUrl);
  res.status(404).json({ 
    message: 'Route not found',
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});