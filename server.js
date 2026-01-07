const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SimamiaKodi API is running',
    version: '1.0.0'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      success: true,
      message: 'Database connected',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// ============================================
// ADD AUTH ROUTES HERE (BEFORE OTHER ROUTES)
// ============================================
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✓ Auth routes loaded');
} catch (err) {
  console.error('✗ Auth routes failed:', err.message);
}

// Test each route one by one
try {
  const tenantRoutes = require('./routes/tenantRoutes');
  app.use('/api/tenants', tenantRoutes);
  console.log('✓ Tenant routes loaded');
} catch (err) {
  console.error('✗ Tenant routes failed:', err.message);
}

try {
  const paymentRoutes = require('./routes/paymentRoutes');
  app.use('/api/payments', paymentRoutes);
  console.log('✓ Payment routes loaded');
} catch (err) {
  console.error('✗ Payment routes failed:', err.message);
}

try {
  const propertyRoutes = require('./routes/propertyRoutes');
  app.use('/api/properties', propertyRoutes);
  console.log('✓ Property routes loaded');
} catch (err) {
  console.error('✗ Property routes failed:', err.message);
}

try {
  const unitRoutes = require('./routes/unitRoutes');
  app.use('/api/units', unitRoutes);
  console.log(' Unit routes loaded');
} catch (err) {
  console.error(' Unit routes failed:', err.message);
}

try {
  const expenseRoutes = require('./routes/expenseRoutes');
  app.use('/api/expenses', expenseRoutes);
  console.log(' Expense routes loaded');
} catch (err) {
  console.error(' Expense routes failed:', err.message);
}

try {
  const utilityRoutes = require('./routes/utilityRoutes');
  app.use('/api/utilities', utilityRoutes);
  console.log(' Utility routes loaded');
} catch (err) {
  console.error(' Utility routes failed:', err.message);
}

try {
  const userRoutes = require('./routes/userRoutes');
  app.use('/api/users', userRoutes);
  console.log(' User routes loaded');
} catch (err) {
  console.error(' User routes failed:', err.message);
}

try {
  const caretakerRoutes = require('./routes/caretakerRoutes');
  app.use('/api/caretaker', caretakerRoutes);
  console.log(' Caretaker routes loaded');
} catch (err) {
  console.error(' Caretaker routes failed:', err.message);
}

app.get('/api/test-payment-plans', (req, res) => {
  res.json({ success: true, message: 'Test route works!' });
});

try {
  const paymentPlanRoutes = require('./routes/paymentPlanRoutes');
  app.use('/api/payment-plans', paymentPlanRoutes);
  console.log(' Payment plan routes loaded');
} catch (err) {
  console.error(' Payment plan routes failed:', err.message);
}

try {
  const agentRoutes = require('./routes/agentRoutes');
  app.use('/api/agents', agentRoutes);
  console.log(' Agent routes loaded');
} catch (err) {
  console.error(' Agent routes failed:', err.message);
}

try {
  const maintenanceRoutes = require('./routes/maintenanceRoutes');
  app.use('/api/maintenance', maintenanceRoutes);
  console.log(' Maintenance routes loaded');
} catch (err) {
  console.error(' Maintenance routes failed:', err.message);
}



// ============================================
// SMS ROUTES - Mobiwave Integration
// ============================================
try {
  const smsRoutes = require('./routes/smsRoutes');
  app.use('/api/sms', smsRoutes);
  console.log(' SMS routes loaded');
} catch (err) {
  console.error(' SMS routes failed:', err.message);
}

try {
  const whatsappRoutes = require('./routes/whatsappRoutes');
  app.use('/api/whatsapp', whatsappRoutes);
  console.log(' WhatsApp routes loaded');
  
  // Initialize WhatsApp Service
  const whatsappService = require('./services/whatsappService');
  whatsappService.initialize();
  console.log(' Initializing WhatsApp client...');
} catch (err) {
  console.error(' WhatsApp routes failed:', err.message);
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log('✓ Server running on http://localhost:' + PORT);
  console.log('✓ Health check: http://localhost:' + PORT + '/api/health');
  console.log('✓ SMS Test: http://localhost:' + PORT + '/api/sms/test');
});

module.exports = app;