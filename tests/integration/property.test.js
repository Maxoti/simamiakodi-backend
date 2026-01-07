const request = require('supertest');
const app = require('../../server');
const { cleanDatabase } = require('../testDatabase');
const pool = require('../../config/db');

describe('Property API Integration Tests', () => {
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
  });

  describe('POST /api/properties', () => {
    test('should create a new property', async () => {
      const response = await request(app)
        .post('/api/properties')
        .send({
          user_id: testUserId,
          property_name: 'Jamii Apartments',
          location: 'Kasarani, Nairobi',
          total_units: 10,
          property_type: 'Apartment'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.property_name).toBe('Jamii Apartments');
    });

    test('should reject property with missing fields', async () => {
      const response = await request(app)
        .post('/api/properties')
        .send({
          property_name: 'Incomplete Property'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/properties', () => {
    test('should return all properties', async () => {
      const response = await request(app).get('/api/properties');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/properties/:id', () => {
    test('should return a specific property', async () => {
      const allProperties = await request(app).get('/api/properties');
      if (allProperties.body.data.length > 0) {
        const propertyId = allProperties.body.data[0].property_id;
        
        const response = await request(app).get(`/api/properties/${propertyId}`);
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });
});