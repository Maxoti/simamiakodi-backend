/**
 * SimamiaKodi Backend Server
 * Production-ready Express.js API with security & performance optimizations
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression'); // npm install compression
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

// Compression - Reduce response size
app.use(compression());

// CORS - Secure cross-origin requests
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5500',
  'https://simamiakodi-frontend.vercel.app',
  'https://simamiakodi-frontend-git-main-edusync.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ Blocked CORS request from: ${origin}`);
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (development only)
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// HEALTH CHECK & STATUS ENDPOINTS
// ============================================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SimamiaKodi API is running',
    version: '1.0.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Health check with database test
app.get('/api/health', async (req, res) => {
  try {
    const dbStart = Date.now();
    const result = await pool.query('SELECT NOW()');
    const dbDuration = Date.now() - dbStart;
    
    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      dbResponseTime: `${dbDuration}ms`,
      timestamp: result.rows[0].now,
      uptime: `${Math.floor(process.uptime())}s`,
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Keep-alive endpoint (prevents Render cold starts)
app.get('/api/keep-alive', (req, res) => {
  res.json({
    success: true,
    message: 'Server is alive',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`
  });
});

// ============================================
// SELF-PING (KEEP SERVER WARM)
// ============================================

if (NODE_ENV === 'production' && process.env.ENABLE_KEEP_ALIVE === 'true') {
  const SELF_PING_INTERVAL = 10 * 60 * 1000; // 10 minutes
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://simamiakodi-backend.onrender.com';
  
  setInterval(async () => {
    try {
      const https = require('https');
      https.get(`${RENDER_URL}/api/keep-alive`, (res) => {
        if (res.statusCode === 200) {
          console.log(`🔄 Self-ping successful (${new Date().toLocaleTimeString()})`);
        }
      }).on('error', (err) => {
        console.error('❌ Self-ping failed:', err.message);
      });
    } catch (error) {
      console.error('❌ Self-ping error:', error.message);
    }
  }, SELF_PING_INTERVAL);
  
  console.log('🔄 Keep-alive self-ping enabled (every 10 minutes)');
}

// ============================================
// API ROUTES
// ============================================

const routes = [
  { path: '/api/auth', file: './routes/auth', name: 'Auth' },
  { path: '/api/tenants', file: './routes/tenantRoutes', name: 'Tenant' },
  { path: '/api/payments', file: './routes/paymentRoutes', name: 'Payment' },
  { path: '/api/properties', file: './routes/propertyRoutes', name: 'Property' },
  { path: '/api/units', file: './routes/unitRoutes', name: 'Unit' },
  { path: '/api/expenses', file: './routes/expenseRoutes', name: 'Expense' },
  { path: '/api/utilities', file: './routes/utilityRoutes', name: 'Utility' },
  { path: '/api/users', file: './routes/userRoutes', name: 'User' },
  { path: '/api/caretaker', file: './routes/caretakerRoutes', name: 'Caretaker' },
  { path: '/api/payment-plans', file: './routes/paymentPlanRoutes', name: 'Payment Plan' },
  { path: '/api/agents', file: './routes/agentRoutes', name: 'Agent' },
  { path: '/api/maintenance', file: './routes/maintenanceRoutes', name: 'Maintenance' },
  { path: '/api/sms', file: './routes/smsRoutes', name: 'SMS' },
  { path: '/api/whatsapp', file: './routes/whatsappRoutes', name: 'WhatsApp' }
];

// Load all routes dynamically
routes.forEach(route => {
  try {
    const routeModule = require(route.file);
    app.use(route.path, routeModule);
    console.log(`✓ ${route.name} routes loaded`);
  } catch (err) {
    console.error(`✗ ${route.name} routes failed:`, err.message);
  }
});

// Initialize WhatsApp Service (if routes loaded successfully)
try {
  const whatsappService = require('./services/whatsappService');
  whatsappService.initialize();
  console.log('📱 Initializing WhatsApp client...');
} catch (err) {
  console.error('❌ WhatsApp service failed:', err.message);
}

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler - Must be after all routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler - Must be last
app.use(errorHandler);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // Close database connections
    await pool.end();
    console.log('✓ Database connections closed');
    
    // Exit process
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============================================
// START SERVER
// ============================================

const server = app.listen(PORT, async () => {
  console.log('═══════════════════════════════════════');
  console.log('  SimamiaKodi API Server');
  console.log('═══════════════════════════════════════');
  console.log(` Environment: ${NODE_ENV}`);
  console.log(` Server: http://localhost:${PORT}`);
  console.log(` Health: http://localhost:${PORT}/api/health`);
  console.log(` SMS Test: http://localhost:${PORT}/api/sms/test`);
  console.log('═══════════════════════════════════════');
  
  // Test database connection on startup
  try {
    await pool.query('SELECT NOW()');
    console.log('✓ Connected to PostgreSQL database');
    const dbTime = await pool.query('SELECT NOW()');
    console.log(`  Timestamp: ${dbTime.rows[0].now}`);
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    console.error('  Check your configuration:');
    console.error('  - DATABASE_URL is set but connection failed');
    console.error('  - Verify the DATABASE_URL is correct');
  }
});

// Export for testing
module.exports = app;