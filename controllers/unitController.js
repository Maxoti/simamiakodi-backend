const pool = require('../config/db');

const getAllUnits = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.*,
        p.property_name,
        p.location,
        t.full_name as tenant_name,
        t.phone as tenant_phone
      FROM units u
      JOIN properties p ON u.property_id = p.property_id
      LEFT JOIN tenants t ON u.unit_id = t.unit_id AND t.is_active = true
      ORDER BY p.property_name, u.unit_number
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

const getUnitById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        u.*,
        p.property_name,
        p.location,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        t.email as tenant_email,
        t.move_in_date as lease_start_date,
        t.move_out_date as lease_end_date
      FROM units u
      JOIN properties p ON u.property_id = p.property_id
      LEFT JOIN tenants t ON u.unit_id = t.unit_id AND t.is_active = true
      WHERE u.unit_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Unit not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

const createUnit = async (req, res, next) => {
  try {
    const {
      property_id,
      unit_number,
      unit_type,
      house_type,
      bedrooms,
      bathrooms,
      square_feet,
      monthly_rent,
      description
    } = req.body;

    // Validate required fields
    if (!property_id || !unit_number || !monthly_rent) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: property_id, unit_number, monthly_rent'
      });
    }

    const result = await pool.query(`
      INSERT INTO units (
        property_id, 
        unit_number, 
        unit_type,
        house_type, 
        bedrooms,
        bathrooms,
        square_feet,
        monthly_rent, 
        description,
        is_occupied
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
      RETURNING *
    `, [
      property_id, 
      unit_number, 
      unit_type || null,
      house_type || null, 
      bedrooms || 0,
      bathrooms || 0,
      square_feet || null,
      monthly_rent,
      description || null
    ]);

    res.status(201).json({
      success: true,
      message: 'Unit created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Unit number already exists in this property'
      });
    }
    next(error);
  }
};

const updateUnit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      property_id,
      unit_number,
      unit_type,
      house_type,
      bedrooms,
      bathrooms,
      square_feet,
      monthly_rent,
      description,
      is_occupied
    } = req.body;

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (property_id !== undefined) {
      updates.push(`property_id = $${paramCount}`);
      values.push(property_id);
      paramCount++;
    }
    if (unit_number !== undefined) {
      updates.push(`unit_number = $${paramCount}`);
      values.push(unit_number);
      paramCount++;
    }
    if (unit_type !== undefined) {
      updates.push(`unit_type = $${paramCount}`);
      values.push(unit_type);
      paramCount++;
    }
    if (house_type !== undefined) {
      updates.push(`house_type = $${paramCount}`);
      values.push(house_type);
      paramCount++;
    }
    if (bedrooms !== undefined) {
      updates.push(`bedrooms = $${paramCount}`);
      values.push(bedrooms);
      paramCount++;
    }
    if (bathrooms !== undefined) {
      updates.push(`bathrooms = $${paramCount}`);
      values.push(bathrooms);
      paramCount++;
    }
    if (square_feet !== undefined) {
      updates.push(`square_feet = $${paramCount}`);
      values.push(square_feet);
      paramCount++;
    }
    if (monthly_rent !== undefined) {
      updates.push(`monthly_rent = $${paramCount}`);
      values.push(monthly_rent);
      paramCount++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }
    if (is_occupied !== undefined) {
      updates.push(`is_occupied = $${paramCount}`);
      values.push(is_occupied);
      paramCount++;
    }

    // Always update the updated_at timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    
    if (updates.length === 1) { // Only updated_at
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    values.push(id);
    
    const result = await pool.query(`
      UPDATE units 
      SET ${updates.join(', ')}
      WHERE unit_id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Unit not found'
      });
    }

    res.json({
      success: true,
      message: 'Unit updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Unit number already exists in this property'
      });
    }
    next(error);
  }
};

const deleteUnit = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if unit has active tenant
    const tenantCheck = await pool.query(
      'SELECT COUNT(*) FROM tenants WHERE unit_id = $1 AND is_active = true',
      [id]
    );

    if (parseInt(tenantCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete unit with active tenant'
      });
    }

    const result = await pool.query(
      'DELETE FROM units WHERE unit_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Unit not found'
      });
    }

    res.json({
      success: true,
      message: 'Unit deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

const getVacantUnits = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.*,
        p.property_name,
        p.location
      FROM units u
      JOIN properties p ON u.property_id = p.property_id
      WHERE u.is_occupied = false
      ORDER BY p.property_name, u.unit_number
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
  getVacantUnits
};