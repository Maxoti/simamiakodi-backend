const pool = require('../config/db');

// Validation utilities
const validators = {
  isPositiveNumber: (value) => !isNaN(value) && parseFloat(value) > 0,
  isValidPercentage: (value) => !isNaN(value) && parseFloat(value) >= 0 && parseFloat(value) <= 100,
  isValidPhone: (phone) => /^[\d\s\-+()]{10,20}$/.test(phone),
  isValidId: (id) => /^\d+$/.test(id)
};

// Enhanced error handler
const handleDatabaseError = (error, res) => {
  console.error('Database error:', error);

  if (error.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Invalid reference: Related record does not exist'
    });
  }

  if (error.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry: Record already exists'
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
    error: 'Database operation failed',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

// ============================================
// AGENT MANAGEMENT FUNCTIONS
// ============================================

/**
 * Get all agents with their commission earnings
 */
const getAllAgents = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.agent_id,
        a.full_name,
        a.phone,
        a.email,
        a.id_number,
        a.commission_rate,
        a.is_active,
        a.created_at,
        a.updated_at,
        COALESCE(SUM(CASE WHEN ac.status = 'paid' THEN ac.commission_amount ELSE 0 END), 0) as total_earned,
        COUNT(ac.commission_id) FILTER (WHERE ac.status = 'paid') as commissions_paid,
        COUNT(ac.commission_id) FILTER (WHERE ac.status = 'pending') as commissions_pending
      FROM agents a
      LEFT JOIN agent_commissions ac ON a.agent_id = ac.agent_id
      GROUP BY a.agent_id
      ORDER BY a.full_name
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    handleDatabaseError(error, res);
  }
};

/**
 * Get agent by ID with earnings details
 */
const getAgentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validators.isValidId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent ID format'
      });
    }
    
    const result = await pool.query(`
      SELECT 
        a.agent_id,
        a.full_name,
        a.phone,
        a.email,
        a.id_number,
        a.commission_rate,
        a.is_active,
        a.created_at,
        a.updated_at,
        COALESCE(SUM(CASE WHEN ac.status = 'paid' THEN ac.commission_amount ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN ac.status = 'pending' THEN ac.commission_amount ELSE 0 END), 0) as pending_amount,
        COUNT(ac.commission_id) FILTER (WHERE ac.status = 'paid') as commissions_paid,
        COUNT(ac.commission_id) FILTER (WHERE ac.status = 'pending') as commissions_pending
      FROM agents a
      LEFT JOIN agent_commissions ac ON a.agent_id = ac.agent_id
      WHERE a.agent_id = $1
      GROUP BY a.agent_id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    handleDatabaseError(error, res);
  }
};

/**
 * Create new agent
 */
const createAgent = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    const {
      full_name,
      phone,
      email,
      id_number,
      commission_rate,
      is_active
    } = req.body;

    // Validate required fields
    if (!full_name || !phone || commission_rate === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: full_name, phone, commission_rate'
      });
    }

    // Validate full_name length
    if (full_name.trim().length < 2 || full_name.trim().length > 255) {
      return res.status(400).json({
        success: false,
        error: 'full_name must be between 2 and 255 characters'
      });
    }

    // Validate commission rate
    if (!validators.isValidPercentage(commission_rate)) {
      return res.status(400).json({
        success: false,
        error: 'commission_rate must be between 0 and 100'
      });
    }

    // Validate phone format
    if (!validators.isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone format (10-20 digits, spaces, dashes, +, parentheses allowed)'
      });
    }

    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO agents (
        full_name, phone, email, id_number, commission_rate, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      full_name.trim(), 
      phone.trim(), 
      email?.trim() || null, 
      id_number?.trim() || null, 
      parseFloat(commission_rate), 
      is_active !== false
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Agent created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating agent:', error);
    
    if (error.code === '23505') {
      if (error.constraint?.includes('id_number')) {
        return res.status(409).json({
          success: false,
          error: 'Agent with this ID number already exists'
        });
      }
      return res.status(409).json({
        success: false,
        error: 'Agent with this information already exists'
      });
    }
    
    handleDatabaseError(error, res);
  } finally {
    client.release();
  }
};

/**
 * Update agent
 */
const updateAgent = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      full_name,
      phone,
      email,
      id_number,
      commission_rate,
      is_active
    } = req.body;

    if (!validators.isValidId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent ID format'
      });
    }

    // Validate full_name length if provided
    if (full_name && (full_name.trim().length < 2 || full_name.trim().length > 255)) {
      return res.status(400).json({
        success: false,
        error: 'full_name must be between 2 and 255 characters'
      });
    }

    // Validate commission rate if provided
    if (commission_rate !== undefined && !validators.isValidPercentage(commission_rate)) {
      return res.status(400).json({
        success: false,
        error: 'commission_rate must be between 0 and 100'
      });
    }

    // Validate phone if provided
    if (phone && !validators.isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone format'
      });
    }

    await client.query('BEGIN');

    // Check if agent exists
    const checkResult = await client.query(
      'SELECT agent_id FROM agents WHERE agent_id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    const result = await client.query(`
      UPDATE agents 
      SET 
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        id_number = COALESCE($4, id_number),
        commission_rate = COALESCE($5, commission_rate),
        is_active = COALESCE($6, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE agent_id = $7
      RETURNING *
    `, [
      full_name?.trim(), 
      phone?.trim(), 
      email?.trim(), 
      id_number?.trim(), 
      commission_rate ? parseFloat(commission_rate) : null, 
      is_active, 
      id
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Agent updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating agent:', error);
    
    if (error.code === '23505') {
      if (error.constraint?.includes('id_number')) {
        return res.status(409).json({
          success: false,
          error: 'Agent with this ID number already exists'
        });
      }
    }
    
    handleDatabaseError(error, res);
  } finally {
    client.release();
  }
};

/**
 * Delete agent
 */
const deleteAgent = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    if (!validators.isValidId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent ID format'
      });
    }

    await client.query('BEGIN');

    // Check if agent has any commissions
    const commissionCheck = await client.query(
      'SELECT COUNT(*) FROM agent_commissions WHERE agent_id = $1',
      [id]
    );

    if (parseInt(commissionCheck.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Cannot delete agent with existing commissions. Consider deactivating instead.',
        suggestion: 'Set is_active to false to deactivate this agent'
      });
    }

    const result = await client.query(`
      DELETE FROM agents 
      WHERE agent_id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Agent deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting agent:', error);
    handleDatabaseError(error, res);
  } finally {
    client.release();
  }
};

/**
 * Get active agents
 */
const getActiveAgents = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.agent_id,
        a.full_name,
        a.phone,
        a.email,
        a.id_number,
        a.commission_rate,
        a.is_active,
        a.created_at,
        a.updated_at,
        COALESCE(SUM(CASE WHEN ac.status = 'paid' THEN ac.commission_amount ELSE 0 END), 0) as total_earned
      FROM agents a
      LEFT JOIN agent_commissions ac ON a.agent_id = ac.agent_id
      WHERE a.is_active = true
      GROUP BY a.agent_id
      ORDER BY a.full_name
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching active agents:', error);
    handleDatabaseError(error, res);
  }
};

/**
 * Get agent statistics
 */
const getAgentStats = async (req, res, next) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_agents,
        COUNT(*) FILTER (WHERE is_active = true) as active_agents,
        COUNT(*) FILTER (WHERE is_active = false) as inactive_agents,
        COALESCE(AVG(commission_rate), 0) as avg_commission_rate,
        COALESCE(MAX(commission_rate), 0) as max_commission_rate,
        COALESCE(MIN(commission_rate), 0) as min_commission_rate
      FROM agents
    `);

    const earnings = await pool.query(`
      SELECT 
        COALESCE(SUM(commission_amount), 0) as total_paid_commissions,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as pending_commissions,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count
      FROM agent_commissions
    `);

    res.json({
      success: true,
      data: {
        agents: stats.rows[0],
        commissions: earnings.rows[0]
      }
    });
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    handleDatabaseError(error, res);
  }
};

module.exports = {
  getAllAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  getActiveAgents,
  getAgentStats
};