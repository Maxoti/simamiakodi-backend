const { Pool } = require('pg');
require('dotenv').config();

// Determine environment
const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';

// Configure pool based on environment
let poolConfig;

if (process.env.DATABASE_URL) {
  // Production environment (Render, Heroku, etc.) - uses DATABASE_URL
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for most cloud PostgreSQL services
    },
    // Connection pool settings
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased for cloud databases
  };
  console.log('✓ Using DATABASE_URL for production database connection');
} else {
  // Local development or test environment
  poolConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: isTest ? process.env.TEST_DB_DATABASE : process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    // Connection pool settings
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
  console.log(`✓ Using local PostgreSQL configuration for ${isTest ? 'test' : 'development'}`);
}

const pool = new Pool(poolConfig);

// Test connection immediately (only in non-test environments)
if (!isTest) {
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('✗ Database connection failed:', err.message);
      console.error('Check your configuration:');
      if (process.env.DATABASE_URL) {
        console.error('  - DATABASE_URL is set but connection failed');
        console.error('  - Verify the DATABASE_URL is correct');
      } else {
        console.error('  - Check your .env file');
        console.error('  - Ensure PostgreSQL is running locally');
      }
    } else {
      console.log('✓ Connected to PostgreSQL database');
      if (!process.env.DATABASE_URL) {
        console.log(`  Database: ${poolConfig.database}`);
        console.log(`  Host: ${poolConfig.host}:${poolConfig.port}`);
      }
      console.log(`  Timestamp: ${res.rows[0].now}`);
    }
  });
}

// Handle unexpected errors
pool.on('error', (err) => {
  console.error('✗ Unexpected database error:', err);
  
  // Don't exit in test environment
  if (!isTest) {
    console.error('Database pool encountered an error. Exiting...');
    process.exit(-1);
  }
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Closing database connection pool...`);
  try {
    await pool.end();
    console.log('✓ Database connection pool closed gracefully');
    process.exit(0);
  } catch (err) {
    console.error('✗ Error closing database pool:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Export pool for use in other modules
module.exports = pool;