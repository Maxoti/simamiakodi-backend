const { Pool } = require('pg');
require('dotenv').config();

// Use test database when running tests, otherwise use main database
const isTest = process.env.NODE_ENV === 'test';

const poolConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: isTest ? process.env.TEST_DB_DATABASE : process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // Connection pool settings for better performance
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
};

const pool = new Pool(poolConfig);

// Test connection immediately (only in non-test environments to avoid noise)
if (!isTest) {
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error(' Database connection failed:', err.message);
      console.error('Check your .env file and ensure PostgreSQL is running');
    } else {
      console.log(` Connected to PostgreSQL database: ${poolConfig.database}`);
      console.log(`   Host: ${poolConfig.host}:${poolConfig.port}`);
    }
  });
}

// Handle unexpected errors
pool.on('error', (err) => {
  console.error(' Unexpected database error:', err);
  // Don't exit in test environment
  if (!isTest) {
    process.exit(-1);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(' Closing database connection pool...');
  await pool.end();
  console.log(' Database connection pool closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(' Closing database connection pool...');
  await pool.end();
  console.log(' Database connection pool closed');
  process.exit(0);
});

module.exports = pool;