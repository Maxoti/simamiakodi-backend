const express = require('express');
const router = express.Router();
const {
  getAllMessages,
  getMessageById,
  logMessage,
  getMessagesByTenant,
  getMessagesByType,
  getMessagesByStatus,  
  checkWhatsAppStatus,
  sendWhatsAppMessage  // Add this import
} = require('../controllers/whatsappController');

// Check WhatsApp connection status
router.get('/status', checkWhatsAppStatus);

// Send WhatsApp message (NEW - Add this route)
router.post('/send-message', sendWhatsAppMessage);

// Get all messages
router.get('/', getAllMessages);

// Get messages by tenant
router.get('/tenant/:tenant_id', getMessagesByTenant);

// Get messages by type
router.get('/type/:type', getMessagesByType);

// Get messages by status
router.get('/status/:status', getMessagesByStatus);

// Get message by ID
router.get('/:id', getMessageById);

// Log message
router.post('/', logMessage);

module.exports = router;