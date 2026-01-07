const pool = require('../config/db');
const whatsappService = require('../services/whatsappService');

// Check WhatsApp connection status
const checkWhatsAppStatus = async (req, res, next) => {
  try {
    const status = whatsappService.getStatus();
    res.json({
      success: true,
      ready: status.ready,
      qrCode: status.qrCode,
      message: status.ready ? 'WhatsApp is connected' : 'WhatsApp is not connected'
    });
  } catch (error) {
    next(error);
  }
};

// Send WhatsApp message
const sendWhatsAppMessage = async (req, res, next) => {
  try {
    const { phone, message, tenant_id, message_type } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    const result = await whatsappService.sendMessage(
      phone, 
      message, 
      tenant_id, 
      message_type || 'general'
    );

    res.json({
      success: true,
      message: 'WhatsApp message sent successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Send rent reminder to specific tenant
const sendRentReminder = async (req, res, next) => {
  try {
    const { tenantId } = req.body;

    // Get tenant details
    const result = await pool.query(`
      SELECT t.*, p.property_name, u.unit_number
      FROM tenants t
      LEFT JOIN properties p ON t.property_id = p.property_id
      LEFT JOIN units u ON t.unit_id = u.unit_id
      WHERE t.tenant_id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    const tenant = result.rows[0];

    if (!tenant.phone) {
      return res.status(400).json({
        success: false,
        error: 'Tenant has no phone number'
      });
    }

    const message = `🏠 *RENT REMINDER*

Hello ${tenant.full_name},

This is a friendly reminder that your rent payment is due soon.

📋 *Details:*
Property: ${tenant.property_name || 'N/A'}
Unit: ${tenant.unit_number || 'N/A'}
Amount: KES ${whatsappService.formatMoney(tenant.rent_amount || 0)}
Due Date: ${whatsappService.getNextMonthFirst()}

Please make your payment to stay current.

Thank you! 🙏
- Simamiakodi Management`;

    await whatsappService.sendMessage(tenant.phone, message, tenantId, 'rent_reminder');

    res.json({
      success: true,
      message: 'Rent reminder sent successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Send payment confirmation
const sendPaymentConfirmation = async (req, res, next) => {
  try {
    const { tenant_id, amount, payment_date } = req.body;

    // Get tenant details
    const result = await pool.query(`
      SELECT t.*, p.property_name, u.unit_number
      FROM tenants t
      LEFT JOIN properties p ON t.property_id = p.property_id
      LEFT JOIN units u ON t.unit_id = u.unit_id
      WHERE t.tenant_id = $1
    `, [tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    const tenant = result.rows[0];

    if (!tenant.phone) {
      return res.status(400).json({
        success: false,
        error: 'Tenant has no phone number'
      });
    }

    const message = `✅ *PAYMENT RECEIVED*

Hello ${tenant.full_name},

We have received your payment. Thank you!

📋 *Details:*
Property: ${tenant.property_name || 'N/A'}
Unit: ${tenant.unit_number || 'N/A'}
Amount: KES ${whatsappService.formatMoney(amount || 0)}
Date: ${payment_date || new Date().toLocaleDateString()}

Your account is now up to date. ✨

- Simamiakodi Management`;

    await whatsappService.sendMessage(tenant.phone, message, tenant_id, 'payment');

    res.json({
      success: true,
      message: 'Payment confirmation sent successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Send bulk rent reminders
const sendAllReminders = async (req, res, next) => {
  try {
    // Get all active tenants with phone numbers
    const result = await pool.query(`
      SELECT t.*, p.property_name, u.unit_number
      FROM tenants t
      LEFT JOIN properties p ON t.property_id = p.property_id
      LEFT JOIN units u ON t.unit_id = u.unit_id
      WHERE t.status = 'active' AND t.phone IS NOT NULL AND t.phone != ''
    `);

    const tenants = result.rows;
    let successCount = 0;
    let failCount = 0;

    for (const tenant of tenants) {
      try {
        const message = `🏠 *RENT REMINDER*

Hello ${tenant.full_name},

This is a friendly reminder that your rent payment is due soon.

📋 *Details:*
Property: ${tenant.property_name || 'N/A'}
Unit: ${tenant.unit_number || 'N/A'}
Amount: KES ${whatsappService.formatMoney(tenant.rent_amount || 0)}
Due Date: ${whatsappService.getNextMonthFirst()}

Please make your payment to stay current.

Thank you! 🙏
- Simamiakodi Management`;

        await whatsappService.sendMessage(tenant.phone, message, tenant.tenant_id, 'rent_reminder');
        successCount++;
        
        // Add delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to send to ${tenant.full_name}:`, error.message);
        failCount++;
      }
    }

    res.json({
      success: true,
      message: `Sent ${successCount} reminders, ${failCount} failed`,
      stats: {
        total: tenants.length,
        sent: successCount,
        failed: failCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Existing message history functions
const getAllMessages = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        wm.*,
        t.full_name as tenant_name,
        u.unit_number,
        p.property_name
      FROM whatsapp_messages wm
      JOIN tenants t ON wm.tenant_id = t.tenant_id
      LEFT JOIN units u ON t.unit_id = u.unit_id
      LEFT JOIN properties p ON t.property_id = p.property_id
      ORDER BY wm.sent_at DESC
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

const getMessageById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const messageId = parseInt(id, 10);
    if (isNaN(messageId)) {
      return res.status(400).json({
        success: false,
        error: `Invalid message ID: "${id}". Must be a number.`
      });
    }
    
    const result = await pool.query(`
      SELECT 
        wm.*,
        t.full_name as tenant_name,
        u.unit_number
      FROM whatsapp_messages wm
      JOIN tenants t ON wm.tenant_id = t.tenant_id
      LEFT JOIN units u ON t.unit_id = u.unit_id
      WHERE wm.message_id = $1
    `, [messageId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
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

const logMessage = async (req, res, next) => {
  try {
    const {
      tenant_id,
      recipient_phone,
      recipient_name,
      message_type,
      message_text,
      status
    } = req.body;

    if (!tenant_id || !recipient_phone || !message_text) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tenant_id, recipient_phone, message_text'
      });
    }

    const result = await pool.query(`
      INSERT INTO whatsapp_messages (
        tenant_id, recipient_phone, recipient_name, message_type, message_text, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [tenant_id, recipient_phone, recipient_name, message_type || 'general', message_text, status || 'pending']);

    res.status(201).json({
      success: true,
      message: 'WhatsApp message logged successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

const getMessagesByTenant = async (req, res, next) => {
  try {
    const { tenant_id } = req.params;
    
    const tenantId = parseInt(tenant_id, 10);
    if (isNaN(tenantId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID. Must be a number.'
      });
    }
    
    const result = await pool.query(`
      SELECT *
      FROM whatsapp_messages
      WHERE tenant_id = $1
      ORDER BY sent_at DESC
    `, [tenantId]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

const getMessagesByType = async (req, res, next) => {
  try {
    const { type } = req.params;
    
    const result = await pool.query(`
      SELECT 
        wm.*,
        t.full_name as tenant_name,
        u.unit_number
      FROM whatsapp_messages wm
      JOIN tenants t ON wm.tenant_id = t.tenant_id
      LEFT JOIN units u ON t.unit_id = u.unit_id
      WHERE wm.message_type = $1
      ORDER BY wm.sent_at DESC
    `, [type]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

const getMessagesByStatus = async (req, res, next) => {
  try {
    const { status } = req.params;
    
    const validStatuses = ['pending', 'sent', 'delivered', 'read', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    const result = await pool.query(`
      SELECT 
        wm.*,
        t.full_name as tenant_name,
        u.unit_number,
        p.property_name
      FROM whatsapp_messages wm
      JOIN tenants t ON wm.tenant_id = t.tenant_id
      LEFT JOIN units u ON t.unit_id = u.unit_id
      LEFT JOIN properties p ON t.property_id = p.property_id
      WHERE wm.status = $1
      ORDER BY wm.sent_at DESC
    `, [status]);

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
  getAllMessages,
  getMessageById,
  logMessage,
  getMessagesByTenant,
  getMessagesByType,
  getMessagesByStatus,
  checkWhatsAppStatus,
  sendWhatsAppMessage,
  sendRentReminder,
  sendPaymentConfirmation,
  sendAllReminders
};