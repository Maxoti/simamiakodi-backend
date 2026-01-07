const pool = require('../config/db');

const getAllProperties = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        COUNT(DISTINCT u.unit_id) as total_units,
        COUNT(DISTINCT CASE WHEN u.is_occupied = true THEN u.unit_id END) as occupied_units,
        COUNT(DISTINCT CASE WHEN u.is_occupied = false THEN u.unit_id END) as vacant_units,
        COUNT(DISTINCT t.tenant_id) as total_tenants
      FROM properties p
      LEFT JOIN units u ON p.property_id = u.property_id
      LEFT JOIN tenants t ON u.unit_id = t.unit_id AND t.is_active = true
      GROUP BY p.property_id
      ORDER BY p.property_name
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

const getPropertyById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        p.*,
        COUNT(DISTINCT u.unit_id) as total_units,
        COUNT(DISTINCT CASE WHEN u.is_occupied = true THEN u.unit_id END) as occupied_units,
        COUNT(DISTINCT CASE WHEN u.is_occupied = false THEN u.unit_id END) as vacant_units
      FROM properties p
      LEFT JOIN units u ON p.property_id = u.property_id
      WHERE p.property_id = $1
      GROUP BY p.property_id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
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
const createProperty = async (req, res, next) => {
  try {
    const {
      user_id,
      property_name,
      location,
      total_units,
      property_type
    } = req.body;

    if (!property_name || !location || !total_units) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: property_name, location, total_units'
      });
    }

    const result = await pool.query(`
      INSERT INTO properties (
        user_id, property_name, location, total_units, property_type
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [user_id || null, property_name, location, total_units, property_type]);

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating property:', error);
    next(error);
  }
};
const updateProperty = async (req, res, next) => {
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
      UPDATE properties 
      SET ${setClause}
      WHERE property_id = $${fields.length + 1}
      RETURNING *
    `, [...values, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    res.json({
      success: true,
      message: 'Property updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

const deleteProperty = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tenantsCheck = await pool.query(`
      SELECT COUNT(*) 
      FROM tenants t
      JOIN units u ON t.unit_id = u.unit_id
      WHERE u.property_id = $1 AND t.is_active = true
    `, [id]);

    if (parseInt(tenantsCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete property with active tenants'
      });
    }

    const result = await pool.query(
      'DELETE FROM properties WHERE property_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty
};