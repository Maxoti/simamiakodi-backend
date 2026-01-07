// controllers/tenantController.js
const db = require('../config/db');

/**
 * Helper: normalize phone number
 * Converts 07XXXXXXXX -> +2547XXXXXXXX
 */
const normalizePhone = (phone) => {
  if (phone.startsWith('07')) {
    return '+254' + phone.slice(1);
  }
  return phone;
};

/**
 * Create a new tenant
 * POST /api/tenants
 */
const createTenant = async (req, res) => {
  try {
    const {
      full_name,
      phone,
      email,
      id_number,
      unit_id,
      emergency_contact_name,
      emergency_contact_phone,
      move_in_date,
      deposit_paid,
      rent_balance
    } = req.body;

    // Required fields
    if (!full_name || !phone || !id_number) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: full_name, phone, id_number'
      });
    }

    const normalizedPhone = normalizePhone(phone);

    // Phone validation
    const phoneRegex = /^\+254[17]\d{8}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Must be +2547XXXXXXXX or 07XXXXXXXX'
      });
    }

    // ID validation
    if (id_number.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'ID number must be at least 8 characters'
      });
    }

    // Check existing tenant by ID
    const existingTenant = await db.query(
      'SELECT tenant_id FROM tenants WHERE id_number = $1',
      [id_number]
    );

    if (existingTenant.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A tenant with this ID number already exists'
      });
    }

    // If unit_id is provided, check if exists & available
    if (unit_id) {
      const unitCheck = await db.query(
        'SELECT is_occupied FROM units WHERE unit_id = $1',
        [unit_id]
      );

      if (unitCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid unit_id - unit does not exist'
        });
      }

      if (unitCheck.rows[0].is_occupied) {
        return res.status(400).json({
          success: false,
          message: 'Unit is already occupied'
        });
      }

      await db.query(
        'UPDATE units SET is_occupied = TRUE WHERE unit_id = $1',
        [unit_id]
      );
    }

    // Insert tenant
    const result = await db.query(
      `INSERT INTO tenants (
        full_name, phone, email, id_number, unit_id,
        emergency_contact_name, emergency_contact_phone,
        move_in_date, deposit_paid, rent_balance, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE)
      RETURNING *`,
      [
        full_name,
        normalizedPhone,
        email || null,
        id_number,
        unit_id || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        move_in_date || null,
        deposit_paid || 0,
        rent_balance || 0
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Tenant created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating tenant:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create tenant',
      error: error.message
    });
  }
};

/**
 * Get all tenants
 * GET /api/tenants
 */
const getAllTenants = async (req, res) => {
  try {
    const { is_active, has_arrears } = req.query;

    let query = `
      SELECT t.*, u.unit_number, u.monthly_rent, p.property_name, p.location
      FROM tenants t
      LEFT JOIN units u ON t.unit_id = u.unit_id
      LEFT JOIN properties p ON u.property_id = p.property_id
      WHERE 1=1
    `;
    const params = [];

    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND t.is_active = $${params.length}`;
    }

    if (has_arrears === 'true') {
      query += ` AND t.rent_balance > 0`;
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await db.query(query, params);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching tenants:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tenants',
      error: error.message
    });
  }
};

/**
 * Get tenant by ID
 * GET /api/tenants/:id
 */
const getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT t.*, u.unit_number, u.monthly_rent, u.house_type,
        p.property_name, p.location
        FROM tenants t
        LEFT JOIN units u ON t.unit_id = u.unit_id
        LEFT JOIN properties p ON u.property_id = p.property_id
        WHERE t.tenant_id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    return res.status(200).json({ success: true, data: result.rows[0] });

  } catch (error) {
    console.error('Error fetching tenant:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch tenant', error: error.message });
  }
};

/**
 * Get tenants with rent arrears
 * GET /api/tenants/arrears
 */
const getTenantsWithArrears = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, u.unit_number, u.monthly_rent, p.property_name, p.location
       FROM tenants t
       LEFT JOIN units u ON t.unit_id = u.unit_id
       LEFT JOIN properties p ON u.property_id = p.property_id
       WHERE t.rent_balance > 0 AND t.is_active = TRUE
       ORDER BY t.rent_balance DESC`
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      total_arrears: result.rows.reduce((sum, t) => sum + parseFloat(t.rent_balance), 0),
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching tenants with arrears:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch tenants with arrears', error: error.message });
  }
};

/**
 * Update tenant
 * PUT /api/tenants/:id
 */
const updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // Normalize phone if present
    if (updates.phone) updates.phone = normalizePhone(updates.phone);

    // Check tenant exists
    const tenantCheck = await db.query('SELECT tenant_id FROM tenants WHERE tenant_id = $1', [id]);
    if (!tenantCheck.rows.length) return res.status(404).json({ success: false, message: 'Tenant not found' });

    // Validate phone if updating
    if (updates.phone) {
      const phoneRegex = /^\+254[17]\d{8}$/;
      if (!phoneRegex.test(updates.phone)) {
        return res.status(400).json({ success: false, message: 'Invalid phone number format' });
      }
    }

    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (key !== 'tenant_id' && updates[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });

    values.push(id);
    const query = `UPDATE tenants SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $${paramCount} RETURNING *`;
    const result = await db.query(query, values);

    return res.status(200).json({ success: true, message: 'Tenant updated successfully', data: result.rows[0] });

  } catch (error) {
    console.error('Error updating tenant:', error);
    return res.status(500).json({ success: false, message: 'Failed to update tenant', error: error.message });
  }
};

/**
 * Soft delete tenant
 * DELETE /api/tenants/:id
 */
const deleteTenant = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE tenants SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 RETURNING *`,
      [id]
    );

    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Tenant not found' });

    // Free unit if occupied
    if (result.rows[0].unit_id) {
      await db.query('UPDATE units SET is_occupied = FALSE WHERE unit_id = $1', [result.rows[0].unit_id]);
    }

    return res.status(200).json({ success: true, message: 'Tenant deactivated successfully', data: result.rows[0] });

  } catch (error) {
    console.error('Error deleting tenant:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete tenant', error: error.message });
  }
};

module.exports = {
  createTenant,
  getAllTenants,
  getTenantById,
  getTenantsWithArrears,
  updateTenant,
  deleteTenant
};
