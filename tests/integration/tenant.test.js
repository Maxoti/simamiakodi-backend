const request = require('supertest');
const app = require('../../server');
const { cleanDatabase } = require('../testDatabase');
const pool = require('../../config/db');

describe('Tenant API Integration Tests', () => {
  let testUserId;
  
  beforeEach(async () => {
    // Create a test user before each test (since cleanDatabase runs before each test)
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
  });

  describe('POST /api/tenants', () => {
    test('should create a new tenant', async () => {
      // First create property and unit
      const propertyRes = await request(app)
        .post('/api/properties')
        .send({
          user_id: testUserId,
          property_name: 'Test Property',
          location: 'Nairobi',
          total_units: 5,
          property_type: 'Apartment'
        });

      const unitRes = await request(app)
        .post('/api/units')
        .send({
          property_id: propertyRes.body.data.property_id,
          unit_number: 'A1',
          house_type: 'Bedsitter',
          monthly_rent: 15000
        });

      const uniqueEmail = `john.${Date.now()}@example.com`;

      const response = await request(app)
        .post('/api/tenants')
        .send({
          unit_id: unitRes.body.data.unit_id,
          full_name: 'John Doe',
          phone: '0712345678',
          email: uniqueEmail,
          move_in_date: '2024-01-01',
          deposit_paid: 30000
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.full_name).toBe('John Doe');
      expect(response.body.data.phone).toBe('+254712345678');
      expect(response.body.data.email).toBe(uniqueEmail);
    });

    test('should reject tenant with invalid phone', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .send({
          unit_id: 1,
          full_name: 'Jane Doe',
          phone: '1234',
          email: 'jane@example.com',
          move_in_date: '2024-01-01'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error || response.body.message).toContain('Invalid phone number');
    });

    test('should reject tenant with invalid email', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .send({
          unit_id: 1,
          full_name: 'Jane Doe',
          phone: '0712345678',
          email: 'not-an-email',
          move_in_date: '2024-01-01'
        });

      expect(response.status).toBe(400);
      expect(response.body.error || response.body.message).toContain('Invalid email');
    });

    test('should reject tenant with missing email', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .send({
          unit_id: 1,
          full_name: 'Jane Doe',
          phone: '0712345678',
          move_in_date: '2024-01-01'
        });

      expect(response.status).toBe(400);
      expect(response.body.error || response.body.message).toContain('email');
    });

    test('should reject duplicate email', async () => {
      // First create property and unit
      const propertyRes = await request(app)
        .post('/api/properties')
        .send({
          user_id: testUserId,
          property_name: 'Test Property 2',
          location: 'Nairobi',
          total_units: 5,
          property_type: 'Apartment'
        });

      const unitRes = await request(app)
        .post('/api/units')
        .send({
          property_id: propertyRes.body.data.property_id,
          unit_number: 'A2',
          house_type: 'Bedsitter',
          monthly_rent: 15000
        });

      const duplicateEmail = 'duplicate@example.com';

      // Create first tenant
      await request(app)
        .post('/api/tenants')
        .send({
          unit_id: unitRes.body.data.unit_id,
          full_name: 'First Tenant',
          phone: '0712345678',
          email: duplicateEmail,
          move_in_date: '2024-01-01',
          deposit_paid: 30000
        });

      // Try to create second tenant with same email
      const response = await request(app)
        .post('/api/tenants')
        .send({
          unit_id: unitRes.body.data.unit_id,
          full_name: 'Second Tenant',
          phone: '0722345678',
          email: duplicateEmail,
          move_in_date: '2024-01-01',
          deposit_paid: 30000
        });

      expect(response.status).toBe(400);
      expect(response.body.error || response.body.message).toContain('email already exists');
    });
  });

  // ... rest of the tests remain the same
  describe('GET /api/tenants', () => {
    test('should return all tenants', async () => {
      const response = await request(app).get('/api/tenants');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/tenants/arrears', () => {
    test('should return tenants with outstanding rent', async () => {
      const response = await request(app).get('/api/tenants/arrears');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/tenants/:id', () => {
    test('should return a specific tenant', async () => {
      const allTenants = await request(app).get('/api/tenants');
      if (allTenants.body.data.length > 0) {
        const tenantId = allTenants.body.data[0].tenant_id;
        
        const response = await request(app).get(`/api/tenants/${tenantId}`);
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tenant_id).toBe(tenantId);
      }
    });

    test('should return 404 for non-existent tenant', async () => {
      const response = await request(app).get('/api/tenants/99999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
describe('PUT /api/tenants/:id', () => {
  test('should update tenant information', async () => {
    const allTenants = await request(app).get('/api/tenants');
    if (allTenants.body.data.length > 0) {
      const tenantId = allTenants.body.data[0].tenant_id;
      
      // Use unique email to avoid duplicate key errors
      const uniqueEmail = `updated_${tenantId}_${Date.now()}@example.com`;
      
      const response = await request(app)
        .put(`/api/tenants/${tenantId}`)
        .send({
          email: uniqueEmail,
          phone: '0722345678'  // Also update phone to verify multiple fields
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(uniqueEmail);
    }
  });
});

  describe('DELETE /api/tenants/:id', () => {
    test('should soft delete a tenant', async () => {
      const allTenants = await request(app).get('/api/tenants');
      if (allTenants.body.data.length > 0) {
        const tenantId = allTenants.body.data[0].tenant_id;
        
        const response = await request(app).delete(`/api/tenants/${tenantId}`);
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });
});