const pool = require('../config/db');

const getAllExpenses = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.expense_id,
        e.property_id,
        e.unit_id,
        e.expense_type,
        e.amount,
        e.expense_date,
        e.description,
        e.vendor_name,
        e.receipt_number,
        e.created_at,
        e.updated_at,
        p.property_name,
        u.unit_number
      FROM expenses e
      LEFT JOIN properties p ON e.property_id = p.property_id
      LEFT JOIN units u ON e.unit_id = u.unit_id
      ORDER BY e.expense_date DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getAllExpenses:', error);
    next(error);
  }
};

const getExpenseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        e.*,
        p.property_name,
        u.unit_number
      FROM expenses e
      LEFT JOIN properties p ON e.property_id = p.property_id
      LEFT JOIN units u ON e.unit_id = u.unit_id
      WHERE e.expense_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in getExpenseById:', error);
    next(error);
  }
};

const createExpense = async (req, res, next) => {
  try {
    const {
      property_id,
      unit_id,
      expense_type,
      amount,
      expense_date,
      description,
      vendor_name,
      receipt_number
    } = req.body;

    console.log('📝 Creating expense with data:', req.body);

    // Validation
    if (!property_id || !expense_type || !amount || !expense_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: property_id, expense_type, amount, expense_date'
      });
    }

    const result = await pool.query(`
      INSERT INTO expenses (
        property_id, 
        unit_id, 
        expense_type, 
        amount, 
        expense_date, 
        description, 
        vendor_name, 
        receipt_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      property_id,
      unit_id || null,
      expense_type,
      amount,
      expense_date,
      description || null,
      vendor_name || null,
      receipt_number || null
    ]);

    console.log('✅ Expense created:', result.rows[0]);

    res.status(201).json({
      success: true,
      message: 'Expense recorded successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error in createExpense:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create expense: ' + error.message
    });
  }
};

const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      property_id,
      unit_id,
      expense_type,
      amount,
      expense_date,
      description,
      vendor_name,
      receipt_number
    } = req.body;

    console.log('📝 Updating expense', id, 'with:', req.body);

    const result = await pool.query(`
      UPDATE expenses
      SET 
        property_id = COALESCE($1, property_id),
        unit_id = COALESCE($2, unit_id),
        expense_type = COALESCE($3, expense_type),
        amount = COALESCE($4, amount),
        expense_date = COALESCE($5, expense_date),
        description = COALESCE($6, description),
        vendor_name = COALESCE($7, vendor_name),
        receipt_number = COALESCE($8, receipt_number),
        updated_at = CURRENT_TIMESTAMP
      WHERE expense_id = $9
      RETURNING *
    `, [
      property_id,
      unit_id,
      expense_type,
      amount,
      expense_date,
      description,
      vendor_name,
      receipt_number,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found'
      });
    }

    console.log('✅ Expense updated successfully');

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error in updateExpense:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update expense: ' + error.message
    });
  }
};

const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Deleting expense', id);

    const result = await pool.query(
      'DELETE FROM expenses WHERE expense_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found'
      });
    }

    console.log('✅ Expense deleted successfully');

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error in deleteExpense:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete expense: ' + error.message
    });
  }
};

const getExpensesByCategory = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        expense_type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM expenses
      GROUP BY expense_type
      ORDER BY total_amount DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getExpensesByCategory:', error);
    next(error);
  }
};

const getMonthlyExpenses = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters: month, year'
      });
    }

    const result = await pool.query(`
      SELECT
        e.*,
        p.property_name,
        u.unit_number
      FROM expenses e
      LEFT JOIN properties p ON e.property_id = p.property_id
      LEFT JOIN units u ON e.unit_id = u.unit_id
      WHERE EXTRACT(MONTH FROM e.expense_date) = $1
        AND EXTRACT(YEAR FROM e.expense_date) = $2
      ORDER BY e.expense_date DESC
    `, [month, year]);

    const totalAmount = result.rows.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

    res.json({
      success: true,
      count: result.rows.length,
      totalAmount: totalAmount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getMonthlyExpenses:', error);
    next(error);
  }
};

module.exports = {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpensesByCategory,
  getMonthlyExpenses
};