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
        t.move_in_date
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
      house_type,
      monthly_rent
    } = req.body;

    if (!property_id || !unit_number || !house_type || !monthly_rent) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: property_id, unit_number, house_type, monthly_rent'
      });
    }

    const result = await pool.query(`
      INSERT INTO units (
        property_id, unit_number, house_type, monthly_rent, is_occupied
      ) VALUES ($1, $2, $3, $4, false)
      RETURNING *
    `, [property_id, unit_number, house_type, monthly_rent]);

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
    const updates = req.body;

    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    
    const result = await pool.query(`
      UPDATE units 
      SET ${setClause}
      WHERE unit_id = $${fields.length + 1}
      RETURNING *
    `, [...values, id]);

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
    next(error);
  }
};

const deleteUnit = async (req, res, next) => {
  try {
    const { id } = req.params;

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
