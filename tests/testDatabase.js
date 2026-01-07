const { Pool } = require('pg');
require('dotenv').config();

const testPool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.TEST_DB_DATABASE || 'simamiakodi_test',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const setupTestDatabase = async () => {
  try {
    await testPool.query('BEGIN');
    console.log(' Test database setup started');
  } catch (error) {
    console.error('Setup error:', error);
  }
};

const teardownTestDatabase = async () => {
  try {
    await testPool.query('ROLLBACK');
    await testPool.end();
    console.log(' Test database cleaned up');
  } catch (error) {
    console.error('Teardown error:', error);
  }
};

const cleanDatabase = async () => {
  try {
    await testPool.query(`
      TRUNCATE TABLE 
        whatsapp_messages,
        maintenance_requests,
        agent_commissions,
        payment_plans,
        utility_bills,
        expenses,
        payments,
        tenants,
        caretakers,
        units,
        properties,
        users
      RESTART IDENTITY CASCADE
    `);
    console.log(' Database cleaned');
  } catch (error) {
    console.error('Clean error:', error);
  }
};

module.exports = {
  testPool,
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase
};