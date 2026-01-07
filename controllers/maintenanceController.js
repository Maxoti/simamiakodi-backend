// controllers/maintenanceController.js
const pool = require('../config/db');

const getAllRequests = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        mr.*,
        u.unit_number,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        p.property_name
      FROM maintenance_requests mr
      LEFT JOIN units u ON mr.unit_id = u.unit_id
      LEFT JOIN tenants t ON mr.tenant_id = t.tenant_id
      LEFT JOIN properties p ON mr.property_id = p.property_id
      ORDER BY mr.created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching maintenance requests:', error);
    next(error);
  }
};

const getRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        mr.*,
        u.unit_number,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        p.property_name
      FROM maintenance_requests mr
      LEFT JOIN units u ON mr.unit_id = u.unit_id
      LEFT JOIN tenants t ON mr.tenant_id = t.tenant_id
      LEFT JOIN properties p ON mr.property_id = p.property_id
      WHERE mr.request_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Maintenance request not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching maintenance request:', error);
    next(error);
  }
};

const createRequest = async (req, res, next) => {
  try {
    const {
      property_id,
      unit_id,
      tenant_id,
      issue_type,
      description,
      priority,
      status,
      reported_date,
      resolved_date,
      assigned_to,
      cost,
      notes
    } = req.body;

    // Validation
    if (!property_id || !unit_id || !issue_type || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: property_id, unit_id, issue_type, description'
      });
    }

    const result = await pool.query(`
      INSERT INTO maintenance_requests (
        property_id,
        unit_id,
        tenant_id,
        issue_type,
        description,
        priority,
        status,
        reported_date,
        resolved_date,
        assigned_to,
        cost,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      property_id,
      unit_id,
      tenant_id || null,
      issue_type,
      description,
      priority || 'medium',
      status || 'pending',
      reported_date || new Date(),
      resolved_date || null,
      assigned_to || null,
      cost || 0,
      notes || null
    ]);

    res.status(201).json({
      success: true,
      message: 'Maintenance request created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating maintenance request:', error);
    next(error);
  }
};

const updateRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      property_id,
      unit_id,
      tenant_id,
      issue_type,
      description,
      priority,
      status,
      reported_date,
      resolved_date,
      assigned_to,
      cost,
      notes
    } = req.body;

    // Check if request exists
    const checkResult = await pool.query(
      'SELECT * FROM maintenance_requests WHERE request_id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Maintenance request not found'
      });
    }

    const result = await pool.query(`
      UPDATE maintenance_requests 
      SET 
        property_id = $1,
        unit_id = $2,
        tenant_id = $3,
        issue_type = $4,
        description = $5,
        priority = $6,
        status = $7,
        reported_date = $8,
        resolved_date = $9,
        assigned_to = $10,
        cost = $11,
        notes = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE request_id = $13
      RETURNING *
    `, [
      property_id,
      unit_id,
      tenant_id || null,
      issue_type,
      description,
      priority,
      status,
      reported_date,
      resolved_date || null,
      assigned_to || null,
      cost || 0,
      notes || null,
      id
    ]);

    res.json({
      success: true,
      message: 'Maintenance request updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating maintenance request:', error);
    next(error);
  }
};

const completeRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cost, notes } = req.body;

    const result = await pool.query(`
      UPDATE maintenance_requests 
      SET 
        status = 'completed',
        resolved_date = CURRENT_DATE,
        cost = $1,
        notes = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE request_id = $3
      RETURNING *
    `, [cost, notes, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Maintenance request not found'
      });
    }

    res.json({
      success: true,
      message: 'Maintenance request marked as completed',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error completing maintenance request:', error);
    next(error);
  }
};

const getPendingRequests = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        mr.*,
        u.unit_number,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        p.property_name
      FROM maintenance_requests mr
      LEFT JOIN units u ON mr.unit_id = u.unit_id
      LEFT JOIN tenants t ON mr.tenant_id = t.tenant_id
      LEFT JOIN properties p ON mr.property_id = p.property_id
      WHERE mr.status IN ('pending', 'in_progress')
      ORDER BY 
        CASE mr.priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        mr.reported_date DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    next(error);
  }
};

module.exports = {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequest,
  completeRequest,
  getPendingRequests
};