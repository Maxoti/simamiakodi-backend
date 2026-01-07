const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { 
  validatePhone, 
  normalizePhone, 
  formatCurrency 
} = require('../utils/helpers');

// POST - Create new tenant
router.post('/', async (req, res) => {
  try {
    const {
      full_name,
      phone,
      email,
      unit_id,
      property_id,
      emergency_contact_name,
      emergency_contact_phone,
      move_in_date,
      deposit_paid
    } = req.body;

    // Validation - UPDATED: removed id_number, added email
    if (!full_name || !phone || !email || !unit_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: full_name, phone, email, unit_id'
      });
    }

    // Validate phone
    if (!validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Check if email already exists
    const emailCheck = await pool.query(
      'SELECT tenant_id FROM tenants WHERE email = $1 AND is_active = true',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A tenant with this email already exists'
      });
    }

    // Normalize phone numbers
    const normalizedPhone = normalizePhone(phone);
    const normalizedEmergencyPhone = emergency_contact_phone 
      ? normalizePhone(emergency_contact_phone) 
      : null;

    // Insert tenant - UPDATED: removed id_number, added email
   // Insert tenant - removed id_number and property_id, added email
const result = await pool.query(
  `INSERT INTO tenants (
    full_name, 
    phone, 
    email,
    unit_id,
    emergency_contact_name, 
    emergency_contact_phone, 
    move_in_date, 
    deposit_paid
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)  
  RETURNING *`,
  [
    full_name,
    normalizedPhone,
    email,
    unit_id,
    emergency_contact_name,
    normalizedEmergencyPhone,
    move_in_date,
    deposit_paid || 0
  ]
);
    // Update unit occupancy
    if (unit_id) {
      await pool.query(
        'UPDATE units SET is_occupied = true WHERE unit_id = $1',
        [unit_id]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Tenant created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        success: false,
        error: 'A tenant with this email already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create tenant'
    });
  }
});

// GET - Get all tenants
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.*,
        u.unit_number,
        u.monthly_rent,
        p.property_name,
        p.location
      FROM tenants t
      LEFT JOIN units u ON t.unit_id = u.unit_id
      LEFT JOIN properties p ON u.property_id = p.property_id
      WHERE t.is_active = true
      ORDER BY t.created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tenants'
    });
  }
});

// GET - Get tenants with arrears
router.get('/arrears', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.*,
        u.unit_number,
        u.monthly_rent,
        p.property_name
      FROM tenants t
      LEFT JOIN units u ON t.unit_id = u.unit_id
      LEFT JOIN properties p ON u.property_id = p.property_id
      WHERE t.is_active = true 
        AND t.rent_balance > 0
      ORDER BY t.rent_balance DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching tenants with arrears:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tenants with arrears'
    });
  }
});

// GET - Get specific tenant
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        t.*,
        u.unit_number,
        u.monthly_rent,
        u.house_type,
        p.property_name,
        p.location
      FROM tenants t
      LEFT JOIN units u ON t.unit_id = u.unit_id
      LEFT JOIN properties p ON u.property_id = p.property_id
      WHERE t.tenant_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tenant'
    });
  }
});

// PUT - Update tenant
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate phone if provided
    if (updates.phone && !validatePhone(updates.phone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    // Validate email if provided
    if (updates.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }
    }

    // Normalize phone numbers
    if (updates.phone) {
      updates.phone = normalizePhone(updates.phone);
    }
    if (updates.emergency_contact_phone) {
      updates.emergency_contact_phone = normalizePhone(updates.emergency_contact_phone);
    }

    const fields = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = Object.values(updates);

    const result = await pool.query(
      `UPDATE tenants SET ${fields} WHERE tenant_id = $1 RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    res.json({
      success: true,
      message: 'Tenant updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating tenant:', error);
    
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'A tenant with this email already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update tenant'
    });
  }
});

// DELETE - Soft delete tenant
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get tenant's unit_id before soft delete
    const tenant = await pool.query(
      'SELECT unit_id FROM tenants WHERE tenant_id = $1',
      [id]
    );

    if (tenant.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Soft delete
    const result = await pool.query(
      `UPDATE tenants 
       SET is_active = false, move_out_date = CURRENT_DATE 
       WHERE tenant_id = $1 
       RETURNING *`,
      [id]
    );

    // Update unit occupancy
    if (tenant.rows[0].unit_id) {
      await pool.query(
        'UPDATE units SET is_occupied = false WHERE unit_id = $1',
        [tenant.rows[0].unit_id]
      );
    }

    res.json({
      success: true,
      message: 'Tenant deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete tenant'
    });
  }
});

module.exports = router;