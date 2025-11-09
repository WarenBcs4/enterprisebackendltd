const express = require('express');
const { XeroClient } = require('xero-node');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Initialize Xero client
const xero = new XeroClient({
  clientId: process.env.XERO_CLIENT_ID,
  clientSecret: process.env.XERO_CLIENT_SECRET,
  redirectUris: [`${process.env.FRONTEND_URL || 'https://kabisakabisa-enterprise-ltd.vercel.app'}/api/xero/callback`],
  scopes: 'openid profile email accounting.transactions accounting.contacts accounting.settings'
});

// Store tokens temporarily (in production, use database)
let xeroTokens = null;

// Get authorization URL
router.get('/authorize', authenticateToken, async (req, res) => {
  try {
    const consentUrl = await xero.buildConsentUrl();
    res.json({ authUrl: consentUrl });
  } catch (error) {
    console.error('Xero authorization error:', error);
    res.status(500).json({ message: 'Failed to get authorization URL' });
  }
});

// Handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ message: 'Authorization code not provided' });
    }

    const tokenSet = await xero.apiCallback(req.url);
    xeroTokens = tokenSet;
    
    // Redirect to admin page with success
    res.redirect(`${process.env.FRONTEND_URL || 'https://kabisakabisa-enterprise-ltd.vercel.app'}/admin?xero=connected`);
  } catch (error) {
    console.error('Xero callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'https://kabisakabisa-enterprise-ltd.vercel.app'}/admin?xero=error`);
  }
});

// Check connection status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    if (!xeroTokens || !xeroTokens.access_token) {
      return res.json({ connected: false });
    }

    // Check if token is still valid
    if (xeroTokens.expires_at && new Date() > new Date(xeroTokens.expires_at * 1000)) {
      // Try to refresh token
      try {
        const refreshedTokens = await xero.refreshToken();
        xeroTokens = refreshedTokens;
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        xeroTokens = null;
        return res.json({ connected: false });
      }
    }

    // Test connection by getting organization info
    await xero.setTokenSet(xeroTokens);
    const response = await xero.accountingApi.getOrganisations();
    
    res.json({ 
      connected: true, 
      organization: response.body.organisations[0]?.name || 'Connected'
    });
  } catch (error) {
    console.error('Xero status check error:', error);
    res.json({ connected: false });
  }
});

// Sync contacts to Xero
router.post('/sync-contacts', authenticateToken, async (req, res) => {
  try {
    if (!xeroTokens) {
      return res.status(401).json({ message: 'Xero not connected' });
    }

    await xero.setTokenSet(xeroTokens);
    
    // Get customers from your database (example)
    const { airtableHelpers, TABLES } = require('../config/airtable');
    const sales = await airtableHelpers.find(TABLES.SALES);
    
    // Extract unique customers
    const customers = [...new Set(sales.map(s => s.customer_name).filter(Boolean))];
    
    const contacts = customers.map(customerName => ({
      name: customerName,
      contactStatus: 'ACTIVE'
    }));

    if (contacts.length > 0) {
      const response = await xero.accountingApi.createContacts('', { contacts });
      res.json({ 
        message: `Synced ${contacts.length} contacts to Xero`,
        synced: response.body.contacts.length
      });
    } else {
      res.json({ message: 'No contacts to sync' });
    }
  } catch (error) {
    console.error('Xero sync contacts error:', error);
    res.status(500).json({ message: 'Failed to sync contacts' });
  }
});

// Sync invoices to Xero
router.post('/sync-invoices', authenticateToken, async (req, res) => {
  try {
    if (!xeroTokens) {
      return res.status(401).json({ message: 'Xero not connected' });
    }

    await xero.setTokenSet(xeroTokens);
    const { dateFrom, dateTo } = req.body;
    
    // Get sales from your database
    const { airtableHelpers, TABLES } = require('../config/airtable');
    let filter = '';
    if (dateFrom && dateTo) {
      filter = `AND({sale_date} >= '${dateFrom}', {sale_date} <= '${dateTo}')`;
    }
    
    const sales = await airtableHelpers.find(TABLES.SALES, filter);
    
    const invoices = sales.map(sale => ({
      type: 'ACCREC',
      contact: {
        name: sale.customer_name || 'Cash Customer'
      },
      date: sale.sale_date || sale.created_at,
      dueDate: sale.sale_date || sale.created_at,
      lineItems: [{
        description: 'Sale Transaction',
        quantity: 1,
        unitAmount: parseFloat(sale.total_amount) || 0,
        accountCode: '200' // Sales account
      }],
      status: 'AUTHORISED',
      reference: `BSN-${sale.id}`
    }));

    if (invoices.length > 0) {
      const response = await xero.accountingApi.createInvoices('', { invoices });
      res.json({ 
        message: `Synced ${invoices.length} invoices to Xero`,
        synced: response.body.invoices.length
      });
    } else {
      res.json({ message: 'No invoices to sync' });
    }
  } catch (error) {
    console.error('Xero sync invoices error:', error);
    res.status(500).json({ message: 'Failed to sync invoices' });
  }
});

// Get Xero reports
router.get('/reports/:reportType', authenticateToken, async (req, res) => {
  try {
    if (!xeroTokens) {
      return res.status(401).json({ message: 'Xero not connected' });
    }

    await xero.setTokenSet(xeroTokens);
    const { reportType } = req.params;
    const { dateFrom, dateTo } = req.query;
    
    let report;
    switch (reportType) {
      case 'profit-loss':
        report = await xero.accountingApi.getReportProfitAndLoss('', {
          fromDate: dateFrom,
          toDate: dateTo
        });
        break;
      case 'balance-sheet':
        report = await xero.accountingApi.getReportBalanceSheet('', {
          date: dateTo || new Date().toISOString().split('T')[0]
        });
        break;
      case 'trial-balance':
        report = await xero.accountingApi.getReportTrialBalance('', {
          date: dateTo || new Date().toISOString().split('T')[0]
        });
        break;
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }
    
    res.json(report.body);
  } catch (error) {
    console.error('Xero reports error:', error);
    res.status(500).json({ message: 'Failed to get report' });
  }
});

// Disconnect Xero
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    xeroTokens = null;
    res.json({ message: 'Disconnected from Xero successfully' });
  } catch (error) {
    console.error('Xero disconnect error:', error);
    res.status(500).json({ message: 'Failed to disconnect' });
  }
});

module.exports = router;