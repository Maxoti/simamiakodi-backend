const pool = require('../config/db');

const getAllPaymentPlans = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.plan_id,
        p.tenant_id,
        p.property_id,
        p.unit_id,
        p.total_amount,
        p.amount_paid,
        p.balance,
        p.installment_amount,
        p.installment_frequency,
        p.start_date,
        p.end_date,
        p.next_due_date,
        p.status,
        p.description,
        p.created_at,
        p.updated_at,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        u.unit_number,
        pr.property_name
      FROM payment_plans p
      LEFT JOIN tenants t ON p.tenant_id = t.tenant_id
      LEFT JOIN properties pr ON p.property_id = pr.property_id
      LEFT JOIN units u ON p.unit_id = u.unit_id
      ORDER BY p.start_date DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Error in getAllPaymentPlans:', error);
    next(error);
  }
};

const getActivePaymentPlans = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.plan_id,
        p.tenant_id,
        p.property_id,
        p.unit_id,
        p.total_amount,
        p.amount_paid,
        p.balance,
        p.installment_amount,
        p.installment_frequency,
        p.start_date,
        p.end_date,
        p.next_due_date,
        p.status,
        p.description,
        p.created_at,
        p.updated_at,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        u.unit_number,
        pr.property_name
      FROM payment_plans p
      LEFT JOIN tenants t ON p.tenant_id = t.tenant_id
      LEFT JOIN properties pr ON p.property_id = pr.property_id
      LEFT JOIN units u ON p.unit_id = u.unit_id
      WHERE p.status = 'active'
      ORDER BY p.next_due_date ASC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Error in getActivePaymentPlans:', error);
    next(error);
  }
};

const getPaymentPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        p.*,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        u.unit_number,
        pr.property_name
      FROM payment_plans p
      LEFT JOIN tenants t ON p.tenant_id = t.tenant_id
      LEFT JOIN properties pr ON p.property_id = pr.property_id
      LEFT JOIN units u ON p.unit_id = u.unit_id
      WHERE p.plan_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment plan not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error in getPaymentPlanById:', error);
    next(error);
  }
};

const createPaymentPlan = async (req, res, next) => {
  try {
    const {
      tenant_id,
      property_id,
      unit_id,
      total_amount,
      installment_amount,
      installment_frequency,
      start_date,
      end_date,
      description
    } = req.body;

    // Log received data for debugging
    console.log('📝 Creating payment plan with data:', {
      tenant_id,
      property_id,
      unit_id,
      total_amount,
      installment_amount,
      installment_frequency,
      start_date,
      end_date,
      description
    });

    // Validate required fields
    if (!tenant_id || !total_amount || !installment_amount || !start_date) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tenant_id, total_amount, installment_amount, start_date'
      });
    }

    // Validate numeric values
    const totalAmt = parseFloat(total_amount);
    const installmentAmt = parseFloat(installment_amount);

    if (isNaN(totalAmt) || isNaN(installmentAmt) || totalAmt <= 0 || installmentAmt <= 0) {
      console.error('❌ Invalid numeric values');
      return res.status(400).json({
        success: false,
        error: 'Total amount and installment amount must be positive numbers'
      });
    }

    if (installmentAmt > totalAmt) {
      console.error('❌ Installment amount exceeds total');
      return res.status(400).json({
        success: false,
        error: 'Installment amount cannot be greater than total amount'
      });
    }

    // Validate installment frequency
    const validFrequencies = ['weekly', 'biweekly', 'monthly', 'quarterly'];
    const frequency = installment_frequency || 'monthly';
    
    if (!validFrequencies.includes(frequency)) {
      console.error('❌ Invalid frequency:', frequency);
      return res.status(400).json({
        success: false,
        error: `Invalid installment frequency. Must be one of: ${validFrequencies.join(', ')}`
      });
    }

    // Calculate balance and next due date
    const balance = totalAmt;
    const nextDueDate = calculateNextDueDate(start_date, frequency);

    console.log('💾 Inserting into database:', {
      tenant_id,
      property_id: property_id || null,
      unit_id: unit_id || null,
      total_amount: totalAmt,
      amount_paid: 0,
      balance,
      installment_amount: installmentAmt,
      installment_frequency: frequency,
      start_date,
      end_date: end_date || null,
      next_due_date: nextDueDate,
      status: 'active',
      description: description || null
    });

    const result = await pool.query(`
      INSERT INTO payment_plans (
        tenant_id, 
        property_id, 
        unit_id, 
        total_amount, 
        amount_paid, 
        balance,
        installment_amount, 
        installment_frequency, 
        start_date, 
        end_date,
        next_due_date, 
        status, 
        description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      tenant_id,
      property_id || null,
      unit_id || null,
      totalAmt,
      0,
      balance,
      installmentAmt,
      frequency,
      start_date,
      end_date || null,
      nextDueDate,
      'active',
      description || null
    ]);

    console.log('✅ Payment plan created successfully:', result.rows[0]);

    res.status(201).json({
      success: true,
      message: 'Payment plan created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error in createPaymentPlan:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Return JSON error instead of HTML
    res.status(500).json({
      success: false,
      error: 'Failed to create payment plan: ' + error.message
    });
  }
};

const updatePaymentPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      installment_amount,
      installment_frequency,
      end_date,
      status,
      description
    } = req.body;

    console.log('📝 Updating payment plan', id, 'with:', req.body);

    const result = await pool.query(`
      UPDATE payment_plans
      SET 
        installment_amount = COALESCE($1, installment_amount),
        installment_frequency = COALESCE($2, installment_frequency),
        end_date = COALESCE($3, end_date),
        status = COALESCE($4, status),
        description = COALESCE($5, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE plan_id = $6
      RETURNING *
    `, [installment_amount, installment_frequency, end_date, status, description, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment plan not found'
      });
    }

    console.log('✅ Payment plan updated successfully');

    res.json({
      success: true,
      message: 'Payment plan updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error in updatePaymentPlan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment plan: ' + error.message
    });
  }
};

const recordInstallmentPayment = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { amount, payment_date, payment_method, reference_number, notes } = req.body;

    console.log('💰 Recording installment payment for plan', id);

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount is required'
      });
    }

    await client.query('BEGIN');

    const planResult = await client.query(
      'SELECT * FROM payment_plans WHERE plan_id = $1',
      [id]
    );

    if (planResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Payment plan not found'
      });
    }

    const plan = planResult.rows[0];
    const newAmountPaid = parseFloat(plan.amount_paid) + parseFloat(amount);
    const newBalance = parseFloat(plan.total_amount) - newAmountPaid;
    
    let newStatus = plan.status;
    if (newBalance <= 0) {
      newStatus = 'completed';
    }

    const nextDueDate = newStatus === 'completed' 
      ? null 
      : calculateNextDueDate(payment_date || new Date(), plan.installment_frequency);

    await client.query(`
      UPDATE payment_plans
      SET 
        amount_paid = $1,
        balance = $2,
        next_due_date = $3,
        status = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE plan_id = $5
    `, [newAmountPaid, newBalance, nextDueDate, newStatus, id]);

    await client.query(`
      INSERT INTO payments (
        tenant_id, property_id, unit_id, amount, payment_date,
        payment_method, reference_number, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      plan.tenant_id, 
      plan.property_id, 
      plan.unit_id, 
      amount,
      payment_date || new Date(), 
      payment_method || 'M-Pesa',
      reference_number, 
      notes || `Installment payment for plan #${id}`
    ]);

    await client.query('COMMIT');

    console.log('✅ Installment payment recorded successfully');

    res.json({
      success: true,
      message: 'Installment payment recorded successfully',
      data: {
        new_amount_paid: newAmountPaid,
        new_balance: newBalance,
        status: newStatus
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in recordInstallmentPayment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record payment: ' + error.message
    });
  } finally {
    client.release();
  }
};

const deletePaymentPlan = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Deleting payment plan', id);

    const result = await pool.query(
      'DELETE FROM payment_plans WHERE plan_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment plan not found'
      });
    }

    console.log('✅ Payment plan deleted successfully');

    res.json({
      success: true,
      message: 'Payment plan deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error in deletePaymentPlan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete payment plan: ' + error.message
    });
  }
};

// Helper function to calculate next due date
function calculateNextDueDate(currentDate, frequency) {
  const date = new Date(currentDate);
  
  switch(frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }
  
  return date.toISOString().split('T')[0];
}

module.exports = {
  getAllPaymentPlans,
  getActivePaymentPlans,
  getPaymentPlanById,
  createPaymentPlan,
  updatePaymentPlan,
  recordInstallmentPayment,
  deletePaymentPlan
};