const pool = require('../config/db');
const { validatePhone } = require('../utils/helpers');

const getAllUsers = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        user_id, full_name, email, phone, role, created_at, last_login
      FROM users
      ORDER BY created_at DESC
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

const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        user_id, full_name, email, phone, role, created_at, last_login
      FROM users
      WHERE user_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
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

const createUser = async (req, res, next) => {
  try {
    const {
      full_name,
      email,
      phone,
      password_hash,
      role
    } = req.body;

    if (!full_name || !email || !phone || !password_hash) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: full_name, email, phone, password_hash'
      });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    const result = await pool.query(`
      INSERT INTO users (
        full_name, email, phone, password_hash, role
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING user_id, full_name, email, phone, role, created_at
    `, [full_name, email, phone, password_hash, role || 'landlord']);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
    }
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    delete updates.password_hash;

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
      UPDATE users 
      SET ${setClause}
      WHERE user_id = $${fields.length + 1}
      RETURNING user_id, full_name, email, phone, role, created_at
      `, [...values, id]);
if (result.rows.length === 0) {
  return res.status(404).json({
    success: false,
    error: 'User not found'
  });
    }

res.json({
  success: true,
  message: 'User updated successfully',
  data: result.rows[0]
});
} catch (error) {
next(error);
}
};
const deleteUser = async (req, res, next) => {
try {
const { id } = req.params;
const propertiesCheck = await pool.query(
  'SELECT COUNT(*) FROM properties WHERE user_id = $1',
  [id]
);

if (parseInt(propertiesCheck.rows[0].count) > 0) {
  return res.status(400).json({
    success: false,
    error: 'Cannot delete user with existing properties'
  });
}

const result = await pool.query(
  'DELETE FROM users WHERE user_id = $1 RETURNING user_id',
  [id]
);

if (result.rows.length === 0) {
  return res.status(404).json({
    success: false,
    error: 'User not found'
  });
}

res.json({
  success: true,
  message: 'User deleted successfully'
});
} catch (error) {
next(error);
}
};
module.exports = {
getAllUsers,
getUserById,
createUser,
updateUser,
deleteUser};
