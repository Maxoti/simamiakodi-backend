const pool = require('../config/db');

/**
 * Get all payments with related information
 */
const getAllPayments = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.payment_id,
        p.tenant_id,
        p.unit_id,
        p.property_id,
        p.amount,
        p.payment_month,
        p.payment_date,
        p.payment_method,
        p.payment_status,
        p.reference_number,
        p.mpesa_code,
        p.notes,
        p.created_at,
        p.updated_at,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        u.unit_number,
        pr.property_name
      FROM payments p
      LEFT JOIN tenants t ON p.tenant_id = t.tenant_id
      LEFT JOIN properties pr ON p.property_id = pr.property_id
      LEFT JOIN units u ON p.unit_id = u.unit_id
      ORDER BY p.payment_date DESC, p.created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getAllPayments:', error);
    next(error);
  }
};

/**
 * Get single payment by ID
 */
const getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        p.*,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        t.email as tenant_email,
        u.unit_number,
        pr.property_name,
        pr.location
      FROM payments p
      LEFT JOIN tenants t ON p.tenant_id = t.tenant_id
      LEFT JOIN properties pr ON p.property_id = pr.property_id
      LEFT JOIN units u ON p.unit_id = u.unit_id
      WHERE p.payment_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in getPaymentById:', error);
    next(error);
  }
};

/**
 * Create new payment
 */
const createPayment = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      tenant_id,
      unit_id,
      property_id,
      amount,
      payment_date,
      payment_month,
      payment_method,
      reference_number,
      mpesa_code,
      notes
    } = req.body;

    // Validation
    if (!tenant_id || !amount || !payment_method) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tenant_id, amount, payment_method'
      });
    }

    // Validate amount is positive
    if (amount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }

    // Default to today if payment_date not provided
    const finalPaymentDate = payment_date || new Date().toISOString().split('T')[0];

    // Ensure payment_month is in YYYY-MM format if provided
    const finalPaymentMonth = payment_month ? payment_month.substring(0, 7) : null;

    // Insert payment
    const result = await client.query(`
      INSERT INTO payments (
        tenant_id, 
        property_id, 
        unit_id, 
        amount, 
        payment_date, 
        payment_month, 
        payment_method, 
        reference_number, 
        mpesa_code, 
        payment_status, 
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', $10)
      RETURNING *
    `, [
      tenant_id,
      property_id || null,
      unit_id || null,
      amount,
      finalPaymentDate,
      finalPaymentMonth,
      payment_method,
      reference_number || null,
      mpesa_code || null,
      notes || null
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in createPayment:', error);
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Update existing payment
 */
const updatePayment = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      amount,
      payment_date,
      payment_month,
      payment_method,
      reference_number,
      mpesa_code,
      payment_status,
      notes
    } = req.body;

    // Check if payment exists
    const checkResult = await client.query(
      'SELECT * FROM payments WHERE payment_id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // Update payment
    const result = await client.query(`
      UPDATE payments 
      SET 
        amount = COALESCE($1, amount),
        payment_date = COALESCE($2, payment_date),
        payment_month = COALESCE($3, payment_month),
        payment_method = COALESCE($4, payment_method),
        reference_number = COALESCE($5, reference_number),
        mpesa_code = COALESCE($6, mpesa_code),
        payment_status = COALESCE($7, payment_status),
        notes = COALESCE($8, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE payment_id = $9
      RETURNING *
    `, [
      amount,
      payment_date,
      payment_month ? payment_month.substring(0, 7) : null,
      payment_method,
      reference_number,
      mpesa_code,
      payment_status,
      notes,
      id
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Payment updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in updatePayment:', error);
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Delete payment (soft delete by changing status)
 */
const deletePayment = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    const result = await client.query(`
      UPDATE payments 
      SET 
        payment_status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP
      WHERE payment_id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Payment cancelled successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in deletePayment:', error);
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Get all payments for a specific tenant
 */
const getPaymentsByTenant = async (req, res, next) => {
  try {
    const { tenant_id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        p.*,
        pr.property_name,
        u.unit_number
      FROM payments p
      LEFT JOIN properties pr ON p.property_id = pr.property_id
      LEFT JOIN units u ON p.unit_id = u.unit_id
      WHERE p.tenant_id = $1
      ORDER BY p.payment_date DESC, p.created_at DESC
    `, [tenant_id]);

    // Calculate total amount paid
    const totalPaid = result.rows.reduce((sum, payment) => 
      sum + parseFloat(payment.amount || 0), 0
    );

    res.json({
      success: true,
      count: result.rows.length,
      totalPaid: totalPaid,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getPaymentsByTenant:', error);
    next(error);
  }
};

/**
 * Get payments for a specific month and year
 */
const getMonthlyPayments = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters: month, year'
      });
    }

    // Validate month and year
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        error: 'Month must be between 1 and 12'
      });
    }

    if (yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year'
      });
    }

    const result = await pool.query(`
      SELECT 
        p.payment_id,
        p.amount,
        p.payment_date,
        p.payment_method,
        p.payment_status,
        p.reference_number,
        p.mpesa_code,
        p.notes,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        pr.property_name,
        u.unit_number
      FROM payments p
      LEFT JOIN tenants t ON p.tenant_id = t.tenant_id
      LEFT JOIN properties pr ON p.property_id = pr.property_id
      LEFT JOIN units u ON p.unit_id = u.unit_id
      WHERE EXTRACT(MONTH FROM p.payment_date) = $1
        AND EXTRACT(YEAR FROM p.payment_date) = $2
      ORDER BY p.payment_date DESC, p.created_at DESC
    `, [monthNum, yearNum]);

    const totalAmount = result.rows
      .filter(p => p.payment_status === 'completed')
      .reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);

    res.json({
      success: true,
      month: monthNum,
      year: yearNum,
      count: result.rows.length,
      totalAmount: totalAmount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getMonthlyPayments:', error);
    next(error);
  }
};

/**
 * Get payments by property
 */
const getPaymentsByProperty = async (req, res, next) => {
  try {
    const { property_id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        p.*,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        u.unit_number
      FROM payments p
      LEFT JOIN tenants t ON p.tenant_id = t.tenant_id
      LEFT JOIN units u ON p.unit_id = u.unit_id
      WHERE p.property_id = $1
      ORDER BY p.payment_date DESC, p.created_at DESC
    `, [property_id]);

    const totalAmount = result.rows
      .filter(p => p.payment_status === 'completed')
      .reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);

    res.json({
      success: true,
      count: result.rows.length,
      totalAmount: totalAmount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getPaymentsByProperty:', error);
    next(error);
  }
};

/**
 * Get payment statistics
 */
const getPaymentStats = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_payments,
        SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) as total_collected,
        AVG(CASE WHEN payment_status = 'completed' THEN amount ELSE NULL END) as average_payment,
        COUNT(DISTINCT tenant_id) as unique_tenants,
        COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN payment_status = 'cancelled' THEN 1 END) as cancelled_payments
      FROM payments
    `);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in getPaymentStats:', error);
    next(error);
  }
};

module.exports = {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentsByTenant,
  getMonthlyPayments,
  getPaymentsByProperty,
  getPaymentStats
};