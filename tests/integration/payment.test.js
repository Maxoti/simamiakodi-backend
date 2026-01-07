const request = require('supertest');
const app = require('../../server');
const { cleanDatabase } = require('../testDatabase');
const pool = require('../../config/db');

describe('Payment API Integration Tests', () => {
  
  let testTenantId;
  let testPropertyId;
  let testUnitId;
  let testUserId;

  beforeEach(async () => {
    // Create a test user before each test
    try {
      const userResult = await pool.query(`
        INSERT INTO users (username, email, password_hash, full_name, phone)
        VALUES ('testuser', 'test@example.com', '$2a$10$dummyhash', 'Test User', '+254712345678')
        RETURNING user_id
      `);
      testUserId = userResult.rows[0].user_id;
    } catch (error) {
      // If user already exists, get the existing user
      const existingUser = await pool.query(`
        SELECT user_id FROM users WHERE username = 'testuser'
      `);
      if (existingUser.rows.length > 0) {
        testUserId = existingUser.rows[0].user_id;
      }
    }

    // Create test property
    const propertyRes = await request(app)
      .post('/api/properties')
      .send({
        user_id: testUserId,
        property_name: 'Payment Test Property',
        location: 'Nairobi',
        total_units: 3
      });
    testPropertyId = propertyRes.body.data.property_id;

    // Create test unit
    const unitRes = await request(app)
      .post('/api/units')
      .send({
        property_id: testPropertyId,
        unit_number: 'B1',
        house_type: 'One Bedroom',
        monthly_rent: 25000
      });
    testUnitId = unitRes.body.data.unit_id;

    // Create test tenant
    const uniqueEmail = `payment.test.${Date.now()}@example.com`;
    const tenantRes = await request(app)
      .post('/api/tenants')
      .send({
        unit_id: testUnitId,
        full_name: 'Payment Test Tenant',
        phone: '0723456789',
        email: uniqueEmail,
        move_in_date: '2024-01-01',
        deposit_paid: 50000
      });

    if (!tenantRes.body.success) {
      console.error('Tenant creation failed:', tenantRes.body);
      throw new Error(`Failed to create test tenant: ${JSON.stringify(tenantRes.body)}`);
    }

    testTenantId = tenantRes.body.data.tenant_id;
  });

  describe('POST /api/payments', () => {
    test('should record a new payment', async () => {
      const response = await request(app)
        .post('/api/payments')
        .send({
          tenant_id: testTenantId,
          property_id: testPropertyId,
          amount: 25000,
          payment_month: '2024-12-01',
          payment_method: 'M-Pesa',
          reference_code: 'QGH12345XX'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe('25000.00');
    });

    test('should reject payment with missing fields', async () => {
      const response = await request(app)
        .post('/api/payments')
        .send({
          tenant_id: testTenantId,
          amount: 25000
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments', () => {
    test('should return all payments', async () => {
      const response = await request(app).get('/api/payments');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/payments/tenant/:tenant_id', () => {
    test('should return payments for specific tenant', async () => {
      const response = await request(app).get(`/api/payments/tenant/${testTenantId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/payments/monthly', () => {
    test('should return monthly payments', async () => {
      const response = await request(app)
        .get('/api/payments/monthly')
        .query({ month: 12, year: 2024 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('totalAmount');
    });
  });
});