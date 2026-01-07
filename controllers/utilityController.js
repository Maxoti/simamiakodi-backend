const pool = require('../config/db');

const getAllUtilities = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        ut.*,
        u.unit_number,
        t.full_name as tenant_name,
        p.property_name
      FROM utilities ut
      JOIN units u ON ut.unit_id = u.unit_id
      JOIN tenants t ON ut.tenant_id = t.tenant_id
      JOIN properties p ON u.property_id = p.property_id
      ORDER BY ut.billing_month DESC, p.property_name, u.unit_number
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

const getUtilityById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        ut.*,
        u.unit_number,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        p.property_name
      FROM utilities ut
      JOIN units u ON ut.unit_id = u.unit_id
      JOIN tenants t ON ut.tenant_id = t.tenant_id
      JOIN properties p ON u.property_id = p.property_id
      WHERE ut.utility_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utility bill not found'
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

const createUtility = async (req, res, next) => {
  try {
    const {
      unit_id,
      tenant_id,
      utility_type,
      billing_month,
      previous_reading,
      current_reading,
      rate_per_unit,
      reading_date,
      notes
    } = req.body;

    if (!unit_id || !tenant_id || !utility_type || !billing_month || !current_reading || !rate_per_unit) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: unit_id, tenant_id, utility_type, billing_month, current_reading, rate_per_unit'
      });
    }

    const unitsConsumed = current_reading - (previous_reading || 0);
    const amountDue = unitsConsumed * rate_per_unit;

    const result = await pool.query(`
      INSERT INTO utilities (
        unit_id, tenant_id, utility_type, billing_month,
        previous_reading, current_reading, units_consumed,
        rate_per_unit, amount_due, reading_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      unit_id, tenant_id, utility_type, billing_month,
      previous_reading || 0, current_reading, unitsConsumed,
      rate_per_unit, amountDue, reading_date || new Date(), notes
    ]);

    res.status(201).json({
      success: true,
      message: 'Utility bill created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

const updateUtility = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.current_reading && updates.previous_reading && updates.rate_per_unit) {
      updates.units_consumed = updates.current_reading - updates.previous_reading;
      updates.amount_due = updates.units_consumed * updates.rate_per_unit;
    }

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
      UPDATE utilities 
      SET ${setClause}
      WHERE utility_id = $${fields.length + 1}
      RETURNING *
    `, [...values, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utility bill not found'
      });
    }

    res.json({
      success: true,
      message: 'Utility bill updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

const deleteUtility = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM utilities WHERE utility_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utility bill not found'
      });
    }

    res.json({
      success: true,
      message: 'Utility bill deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

const getPendingUtilities = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        ut.*,
        u.unit_number,
        t.full_name as tenant_name,
        t.phone as tenant_phone,
        t.whatsapp_number,
        p.property_name
      FROM utilities ut
      JOIN units u ON ut.unit_id = u.unit_id
      JOIN tenants t ON ut.tenant_id = t.tenant_id
      JOIN properties p ON u.property_id = p.property_id
      WHERE ut.payment_status = 'pending'
      ORDER BY ut.billing_month DESC
    `);

    const totalPending = result.rows.reduce((sum, utility) => {
      return sum + (parseFloat(utility.amount_due) - parseFloat(utility.amount_paid));
    }, 0);

    res.json({
      success: true,
      count: result.rows.length,
      totalPending: totalPending,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

const getUtilitiesByTenant = async (req, res, next) => {
  try {
    const { tenant_id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        ut.*,
        u.unit_number,
        p.property_name
      FROM utilities ut
      JOIN units u ON ut.unit_id = u.unit_id
      JOIN properties p ON u.property_id = p.property_id
      WHERE ut.tenant_id = $1
      ORDER BY ut.billing_month DESC
    `, [tenant_id]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

const markUtilityAsPaid = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount_paid } = req.body;

    if (!amount_paid) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: amount_paid'
      });
    }

    const utilityCheck = await pool.query(
      'SELECT amount_due FROM utilities WHERE utility_id = $1',
      [id]
    );

    if (utilityCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utility bill not found'
      });
    }

    const amountDue = parseFloat(utilityCheck.rows[0].amount_due);
    const amountPaidValue = parseFloat(amount_paid);

    let paymentStatus = 'pending';
    if (amountPaidValue >= amountDue) {
      paymentStatus = 'paid';
    } else if (amountPaidValue > 0) {
      paymentStatus = 'partial';
    }

    const result = await pool.query(`
      UPDATE utilities 
      SET amount_paid = $1, payment_status = $2
      WHERE utility_id = $3
      RETURNING *
    `, [amount_paid, paymentStatus, id]);

    res.json({
      success: true,
      message: 'Utility payment recorded successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUtilities,
  getUtilityById,
  createUtility,
  updateUtility,
  deleteUtility,
  getPendingUtilities,
  getUtilitiesByTenant,
  markUtilityAsPaid
};