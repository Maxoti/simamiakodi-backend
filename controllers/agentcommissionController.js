const pool = require('../config/db');

// Validation utilities
const validators = {
  isPositiveNumber: (value) => !isNaN(value) && parseFloat(value) > 0,
  isValidPercentage: (value) => !isNaN(value) && parseFloat(value) >= 0 && parseFloat(value) <= 100,
  isValidPhone: (phone) => /^[\d\s\-+()]{10,20}$/.test(phone),
  isValidStatus: (status) => ['pending', 'paid', 'cancelled'].includes(status),
  isValidId: (id) => /^\d+$/.test(id)
};

// Allowed fields for update operations (prevents SQL injection)
const UPDATEABLE_FIELDS = [
  'tenant_id',
  'property_id',
  'agent_name',
  'agent_phone',
  'commission_amount',
  'commission_percentage',
  'status',
  'notes'
];

// Input validation middleware
const validateCommissionInput = (data, isUpdate = false) => {
  const errors = [];

  if (!isUpdate) {
    if (!data.property_id) errors.push('property_id is required');
    if (!data.agent_name) errors.push('agent_name is required');
    if (!data.commission_amount) errors.push('commission_amount is required');
  }

  if (data.commission_amount && !validators.isPositiveNumber(data.commission_amount)) {
    errors.push('commission_amount must be a positive number');
  }

  if (data.commission_percentage !== undefined && data.commission_percentage !== null) {
    if (!validators.isValidPercentage(data.commission_percentage)) {
      errors.push('commission_percentage must be between 0 and 100');
    }
  }

  if (data.agent_phone && !validators.isValidPhone(data.agent_phone)) {
    errors.push('agent_phone format is invalid');
  }

  if (data.status && !validators.isValidStatus(data.status)) {
    errors.push('status must be one of: pending, paid, cancelled');
  }

  if (data.agent_name && (data.agent_name.length < 2 || data.agent_name.length > 100)) {
    errors.push('agent_name must be between 2 and 100 characters');
  }

  return errors;
};

// Enhanced error handler
const handleDatabaseError = (error, res) => {
  console.error('Database error:', error);

  // Handle specific PostgreSQL errors
  if (error.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Invalid reference: Property or tenant does not exist'
    });
  }

  if (error.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry detected'
    });
  }

  if (error.code === '22P02') {
    return res.status(400).json({
      success: false,
      error: 'Invalid data format'
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Database operation failed'
  });
};

/**
 * Get all commissions with pagination and filtering
 */
const getAllCommissions = async (req, res, next) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 per page
    const offset = (page - 1) * limit;

    // Filter parameters
    const { status, property_id, agent_name, date_from, date_to } = req.query;

    // Build dynamic WHERE clause
    let whereConditions = [];
    let queryParams = [];
    let paramCounter = 1;

    if (status && validators.isValidStatus(status)) {
      whereConditions.push(`ac.status = $${paramCounter}`);
      queryParams.push(status);
      paramCounter++;
    }

    if (property_id && validators.isValidId(property_id)) {
      whereConditions.push(`ac.property_id = $${paramCounter}`);
      queryParams.push(property_id);
      paramCounter++;
    }

    if (agent_name) {
      whereConditions.push(`ac.agent_name ILIKE $${paramCounter}`);
      queryParams.push(`%${agent_name}%`);
      paramCounter++;
    }

    if (date_from) {
      whereConditions.push(`ac.created_at >= $${paramCounter}`);
      queryParams.push(date_from);
      paramCounter++;
    }

    if (date_to) {
      whereConditions.push(`ac.created_at <= $${paramCounter}`);
      queryParams.push(date_to);
      paramCounter++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Get total count for pagination
    const countResult = await pool.query(`
      SELECT COUNT(*) 
      FROM agent_commissions ac
      ${whereClause}
    `, queryParams);

    const totalRecords = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalRecords / limit);

    // Get paginated results
    const result = await pool.query(`
      SELECT 
        ac.*,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        t.email as tenant_email,
        u.unit_number,
        u.monthly_rent,
        p.property_name,
        p.address as property_address
      FROM agent_commissions ac
      LEFT JOIN tenants t ON ac.tenant_id = t.tenant_id
      LEFT JOIN units u ON t.unit_id = u.unit_id
      JOIN properties p ON ac.property_id = p.property_id
      ${whereClause}
      ORDER BY ac.created_at DESC, ac.commission_id DESC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `, [...queryParams, limit, offset]);

    res.json({
      success: true,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      data: result.rows
    });
  } catch (error) {
    handleDatabaseError(error, res);
  }
};

/**
 * Get commission by ID
 */
const getCommissionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validators.isValidId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid commission ID format'
      });
    }
    
    const result = await pool.query(`
      SELECT 
        ac.*,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        t.email as tenant_email,
        u.unit_number,
        p.property_name,
        p.address as property_address
      FROM agent_commissions ac
      LEFT JOIN tenants t ON ac.tenant_id = t.tenant_id
      LEFT JOIN units u ON t.unit_id = u.unit_id
      JOIN properties p ON ac.property_id = p.property_id
      WHERE ac.commission_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Commission record not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    handleDatabaseError(error, res);
  }
};

/**
 * Create new commission with validation
 */
const createCommission = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    const {
      tenant_id,
      property_id,
      agent_name,
      agent_phone,
      commission_amount,
      commission_percentage,
      notes
    } = req.body;

    // Validate input
    const validationErrors = validateCommissionInput(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: validationErrors
      });
    }

    await client.query('BEGIN');

    // Verify property exists
    const propertyCheck = await client.query(
      'SELECT property_id FROM properties WHERE property_id = $1',
      [property_id]
    );

    if (propertyCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Property does not exist'
      });
    }

    // Verify tenant exists if provided
    if (tenant_id) {
      const tenantCheck = await client.query(
        'SELECT tenant_id FROM tenants WHERE tenant_id = $1',
        [tenant_id]
      );

      if (tenantCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Tenant does not exist'
        });
      }

      // Verify tenant belongs to the property
      const tenantPropertyCheck = await client.query(`
        SELECT t.tenant_id 
        FROM tenants t
        JOIN units u ON t.unit_id = u.unit_id
        WHERE t.tenant_id = $1 AND u.property_id = $2
      `, [tenant_id, property_id]);

      if (tenantPropertyCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Tenant does not belong to the specified property'
        });
      }
    }

    // Insert commission record
    const result = await client.query(`
      INSERT INTO agent_commissions (
        tenant_id, property_id, agent_name, agent_phone,
        commission_amount, commission_percentage, status, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW())
      RETURNING *
    `, [tenant_id, property_id, agent_name.trim(), agent_phone, commission_amount, commission_percentage, notes]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Agent commission recorded successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    handleDatabaseError(error, res);
  } finally {
    client.release();
  }
};

/**
 * Update commission with field whitelisting
 */
const updateCommission = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const updates = req.body;

    if (!validators.isValidId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid commission ID format'
      });
    }

    // Filter to only allowed fields (prevents SQL injection)
    const allowedUpdates = {};
    Object.keys(updates).forEach(key => {
      if (UPDATEABLE_FIELDS.includes(key)) {
        allowedUpdates[key] = updates[key];
      }
    });

    const fields = Object.keys(allowedUpdates);
    const values = Object.values(allowedUpdates);
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    // Validate the updates
    const validationErrors = validateCommissionInput(allowedUpdates, true);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: validationErrors
      });
    }

    await client.query('BEGIN');

    // Check if commission exists and get current status
    const checkResult = await client.query(
      'SELECT status FROM agent_commissions WHERE commission_id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Commission record not found'
      });
    }

    // Prevent updating paid commissions (business rule)
    if (checkResult.rows[0].status === 'paid' && !updates.notes) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Cannot modify paid commissions. Only notes can be updated.'
      });
    }

    // Build SET clause with whitelisted fields
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    
    const result = await client.query(`
      UPDATE agent_commissions 
      SET ${setClause}, updated_at = NOW()
      WHERE commission_id = $${fields.length + 1}
      RETURNING *
    `, [...values, id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Commission updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    handleDatabaseError(error, res);
  } finally {
    client.release();
  }
};

/**
 * Mark commission as paid
 */
const markAsPaid = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { paid_date, payment_reference } = req.body;

    if (!validators.isValidId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid commission ID format'
      });
    }

    await client.query('BEGIN');

    // Check current status
    const checkResult = await client.query(
      'SELECT status, commission_amount FROM agent_commissions WHERE commission_id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Commission record not found'
      });
    }

    if (checkResult.rows[0].status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Commission is already marked as paid'
      });
    }

    const paidDateValue = paid_date ? new Date(paid_date).toISOString() : new Date().toISOString();

    const result = await client.query(`
      UPDATE agent_commissions 
      SET status = 'paid', 
          paid_date = $1,
          payment_reference = $2,
          updated_at = NOW()
      WHERE commission_id = $3
      RETURNING *
    `, [paidDateValue, payment_reference, id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Commission marked as paid',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    handleDatabaseError(error, res);
  } finally {
    client.release();
  }
};

/**
 * Get pending commissions summary
 */
const getPendingCommissions = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        ac.*,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        p.property_name,
        p.address as property_address
      FROM agent_commissions ac
      LEFT JOIN tenants t ON ac.tenant_id = t.tenant_id
      JOIN properties p ON ac.property_id = p.property_id
      WHERE ac.status = 'pending'
      ORDER BY ac.created_at DESC, ac.commission_id DESC
    `);

    const totalPending = result.rows.reduce((sum, comm) => {
      return sum + parseFloat(comm.commission_amount || 0);
    }, 0);

    // Group by agent
    const byAgent = result.rows.reduce((acc, comm) => {
      const agent = comm.agent_name;
      if (!acc[agent]) {
        acc[agent] = {
          agent_name: agent,
          agent_phone: comm.agent_phone,
          count: 0,
          total: 0,
          commissions: []
        };
      }
      acc[agent].count++;
      acc[agent].total += parseFloat(comm.commission_amount || 0);
      acc[agent].commissions.push(comm);
      return acc;
    }, {});

    res.json({
      success: true,
      summary: {
        totalPending: parseFloat(totalPending.toFixed(2)),
        count: result.rows.length,
        uniqueAgents: Object.keys(byAgent).length
      },
      byAgent: Object.values(byAgent),
      data: result.rows
    });
  } catch (error) {
    handleDatabaseError(error, res);
  }
};

/**
 * Get commission statistics
 */
const getCommissionStats = async (req, res, next) => {
  try {
    const { start_date, end_date, property_id } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramCounter = 1;

    if (start_date) {
      whereConditions.push(`ac.created_at >= $${paramCounter}`);
      queryParams.push(start_date);
      paramCounter++;
    }

    if (end_date) {
      whereConditions.push(`ac.created_at <= $${paramCounter}`);
      queryParams.push(end_date);
      paramCounter++;
    }

    if (property_id && validators.isValidId(property_id)) {
      whereConditions.push(`ac.property_id = $${paramCounter}`);
      queryParams.push(property_id);
      paramCounter++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_commissions,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        COALESCE(SUM(commission_amount), 0) as total_amount,
        COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
        COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0) as paid_amount,
        COALESCE(AVG(commission_amount), 0) as average_commission,
        COUNT(DISTINCT agent_name) as unique_agents
      FROM agent_commissions ac
      ${whereClause}
    `, queryParams);

    res.json({
      success: true,
      data: {
        ...stats.rows[0],
        total_amount: parseFloat(stats.rows[0].total_amount).toFixed(2),
        pending_amount: parseFloat(stats.rows[0].pending_amount).toFixed(2),
        paid_amount: parseFloat(stats.rows[0].paid_amount).toFixed(2),
        average_commission: parseFloat(stats.rows[0].average_commission).toFixed(2)
      }
    });
  } catch (error) {
    handleDatabaseError(error, res);
  }
};

/**
 * Delete/Cancel commission
 */
const deleteCommission = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!validators.isValidId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid commission ID format'
      });
    }

    await client.query('BEGIN');

    const checkResult = await client.query(
      'SELECT status FROM agent_commissions WHERE commission_id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Commission record not found'
      });
    }

    if (checkResult.rows[0].status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Cannot delete paid commissions. Please contact administrator.'
      });
    }

    // Soft delete by marking as cancelled
    const result = await client.query(`
      UPDATE agent_commissions 
      SET status = 'cancelled',
          notes = CONCAT(COALESCE(notes, ''), ' [CANCELLED: ', COALESCE($1, 'No reason provided'), ']'),
          updated_at = NOW()
      WHERE commission_id = $2
      RETURNING *
    `, [reason, id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Commission cancelled successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    handleDatabaseError(error, res);
  } finally {
    client.release();
  }
};

module.exports = {
  getAllCommissions,
  getCommissionById,
  createCommission,
  updateCommission,
  markAsPaid,
  getPendingCommissions,
  getCommissionStats,
  deleteCommission
};