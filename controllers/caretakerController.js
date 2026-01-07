const pool = require('../config/db');

const getAllCaretakers = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.*,
        p.property_name,
        p.location
      FROM caretakers c
      LEFT JOIN properties p ON c.property_id = p.property_id
      ORDER BY p.property_name, c.full_name
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

const getCaretakerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        c.*,
        p.property_name,
        p.location
      FROM caretakers c
      LEFT JOIN properties p ON c.property_id = p.property_id
      WHERE c.caretaker_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Caretaker not found'
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

const createCaretaker = async (req, res, next) => {
  try {
    const {
      property_id,
      full_name,
      phone,
      email,
      id_number,
      salary
    } = req.body;

    // Validate required fields
    if (!full_name || !phone || !salary) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: full_name, phone, salary'
      });
    }

    // Check if ID number already exists (only if provided)
    if (id_number) {
      const checkId = await pool.query(
        'SELECT caretaker_id, full_name FROM caretakers WHERE id_number = $1',
        [id_number]
      );

      if (checkId.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate ID Number',
          message: `A caretaker with ID number ${id_number} already exists (${checkId.rows[0].full_name})`
        });
      }
    }

    // Check if phone already exists
    const checkPhone = await pool.query(
      'SELECT caretaker_id, full_name FROM caretakers WHERE phone = $1',
      [phone]
    );

    if (checkPhone.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate Phone Number',
        message: `A caretaker with phone ${phone} already exists (${checkPhone.rows[0].full_name})`
      });
    }

    // Insert new caretaker
    const result = await pool.query(`
      INSERT INTO caretakers (
        property_id, full_name, phone, email, id_number, salary, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `, [property_id || null, full_name, phone, email || null, id_number || null, salary]);

    res.status(201).json({
      success: true,
      message: 'Caretaker added successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating caretaker:', error);
    
    // Handle specific PostgreSQL errors
    if (error.code === '23505') { // Unique violation
      if (error.constraint === 'caretakers_id_number_key') {
        return res.status(409).json({
          success: false,
          error: 'Duplicate ID Number',
          message: 'This ID number is already registered to another caretaker'
        });
      }
      if (error.constraint === 'caretakers_phone_key') {
        return res.status(409).json({
          success: false,
          error: 'Duplicate Phone Number',
          message: 'This phone number is already registered to another caretaker'
        });
      }
    }
    
    next(error);
  }
};

const updateCaretaker = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      property_id,
      full_name,
      phone,
      email,
      id_number,
      salary,
      is_active
    } = req.body;

    // Check if caretaker exists
    const checkResult = await pool.query(
      'SELECT * FROM caretakers WHERE caretaker_id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Caretaker not found'
      });
    }

    // Check for duplicate ID number (if provided and different from current)
    if (id_number && id_number !== checkResult.rows[0].id_number) {
      const checkId = await pool.query(
        'SELECT caretaker_id, full_name FROM caretakers WHERE id_number = $1 AND caretaker_id != $2',
        [id_number, id]
      );

      if (checkId.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate ID Number',
          message: `ID number ${id_number} is already registered to ${checkId.rows[0].full_name}`
        });
      }
    }

    // Check for duplicate phone (if provided and different from current)
    if (phone && phone !== checkResult.rows[0].phone) {
      const checkPhone = await pool.query(
        'SELECT caretaker_id, full_name FROM caretakers WHERE phone = $1 AND caretaker_id != $2',
        [phone, id]
      );

      if (checkPhone.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate Phone Number',
          message: `Phone ${phone} is already registered to ${checkPhone.rows[0].full_name}`
        });
      }
    }

    const result = await pool.query(`
      UPDATE caretakers 
      SET 
        property_id = COALESCE($1, property_id),
        full_name = COALESCE($2, full_name),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        id_number = COALESCE($5, id_number),
        salary = COALESCE($6, salary),
        is_active = COALESCE($7, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE caretaker_id = $8
      RETURNING *
    `, [property_id, full_name, phone, email, id_number, salary, is_active, id]);

    res.json({
      success: true,
      message: 'Caretaker updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating caretaker:', error);
    
    // Handle specific PostgreSQL errors
    if (error.code === '23505') { // Unique violation
      if (error.constraint === 'caretakers_id_number_key') {
        return res.status(409).json({
          success: false,
          error: 'Duplicate ID Number',
          message: 'This ID number is already registered to another caretaker'
        });
      }
      if (error.constraint === 'caretakers_phone_key') {
        return res.status(409).json({
          success: false,
          error: 'Duplicate Phone Number',
          message: 'This phone number is already registered to another caretaker'
        });
      }
    }
    
    next(error);
  }
};

const deleteCaretaker = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE caretakers 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE caretaker_id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Caretaker not found'
      });
    }

    res.json({
      success: true,
      message: 'Caretaker deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

const getActiveCaretakers = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.*,
        p.property_name,
        p.location
      FROM caretakers c
      LEFT JOIN properties p ON c.property_id = p.property_id
      WHERE c.is_active = true
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

module.exports = {
  getAllCaretakers,
  getCaretakerById,
  createCaretaker,
  updateCaretaker,
  deleteCaretaker,
  getActiveCaretakers
};