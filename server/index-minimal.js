const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Basic CORS for all origins in production (temporary fix)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'BSN Manager Backend API is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
});

// Favicon
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Mock user data
const mockUsers = [
  {
    id: 'user1',
    email: 'admin@company.com',
    password: 'password123',
    fullName: 'System Admin',
    role: 'admin',
    branchId: 'branch1'
  },
  {
    id: 'user2', 
    email: 'boss@company.com',
    password: 'password123',
    fullName: 'Company Boss',
    role: 'boss',
    branchId: null
  },
  {
    id: 'user3',
    email: 'manager@company.com', 
    password: 'password123',
    fullName: 'Branch Manager',
    role: 'manager',
    branchId: 'branch1'
  }
];

// Register endpoint
app.post('/api/auth/register', (req, res) => {
  const { full_name, email, password } = req.body;
  
  if (!full_name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  
  const existingUser = mockUsers.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists' });
  }
  
  res.status(201).json({ message: 'Admin account created successfully' });
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  const user = mockUsers.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  const accessToken = 'mock-access-token-' + Date.now();
  const refreshToken = 'mock-refresh-token-' + Date.now();
  
  res.json({
    success: true,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      branchId: user.branchId
    }
  });
});

// Public branches route
app.get('/api/branches/public', (req, res) => {
  res.json([
    {
      id: 'branch1',
      name: 'Main Branch',
      address: '123 Main Street, Nairobi',
      latitude: -1.2921,
      longitude: 36.8219,
      phone: '+254700000000',
      email: 'main@company.com'
    }
  ]);
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Minimal BSN Backend running on port ${PORT}`);
});

module.exports = app;