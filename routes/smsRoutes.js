// routes/smsRoutes.js
// SMS API Routes for SimamiaKodi Rent Management System

const express = require('express');
const router = express.Router();
const MobiwaveSMS = require('../services/smsService');
const pool = require('../config/db'); // Adjust path to your database config

const smsService = new MobiwaveSMS();

/**
 * POST /api/sms/send-rent-reminders
 * Send rent reminders to tenants
 * Body: { reminderType: 'upcoming' | 'due-today' | 'overdue' }
 */
router.post('/send-rent-reminders', async (req, res) => {
    try {
        const { reminderType } = req.body;

        if (!['upcoming', 'due-today', 'overdue'].includes(reminderType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reminder type. Use: upcoming, due-today, or overdue'
            });
        }
        
        let query;
        const params = [];
        
        if (reminderType === 'upcoming') {
            // 3 days before due date (customize as needed)
            query = `
                SELECT 
                    t.tenant_id,
                    t.full_name as tenant_name,
                    t.phone,
                    u.unit_number as house_number,
                    u.monthly_rent as rent_amount,
                    TO_CHAR(CURRENT_DATE + INTERVAL '3 days', 'DD/MM/YYYY') as due_date
                FROM tenants t
                JOIN units u ON t.unit_id = u.unit_id
                WHERE t.is_active = true 
                AND t.rent_balance > 0
            `;
        } else if (reminderType === 'due-today') {
            query = `
                SELECT 
                    t.tenant_id,
                    t.full_name as tenant_name,
                    t.phone,
                    u.unit_number as house_number,
                    u.monthly_rent as rent_amount,
                    TO_CHAR(CURRENT_DATE, 'DD/MM/YYYY') as due_date
                FROM tenants t
                JOIN units u ON t.unit_id = u.unit_id
                WHERE t.is_active = true 
                AND t.rent_balance > 0
            `;
        } else if (reminderType === 'overdue') {
            query = `
                SELECT 
                    t.tenant_id,
                    t.full_name as tenant_name,
                    t.phone,
                    u.unit_number as house_number,
                    t.rent_balance as rent_amount,
                    7 as days_overdue
                FROM tenants t
                JOIN units u ON t.unit_id = u.unit_id
                WHERE t.is_active = true 
                AND t.rent_balance > 0
            `;
        }

        const result = await pool.query(query, params);
        const tenants = result.rows;

        if (tenants.length === 0) {
            return res.json({
                success: true,
                message: 'No tenants found matching the criteria',
                stats: { sent: 0, failed: 0, total: 0 }
            });
        }
        
        let sentCount = 0;
        let failedCount = 0;
        const errors = [];

        for (const tenant of tenants) {
            let smsResult;
            
            if (reminderType === 'overdue') {
                smsResult = await smsService.sendOverdueNotice(
                    tenant.tenant_name,
                    tenant.phone,
                    tenant.house_number,
                    tenant.rent_amount,
                    tenant.days_overdue,
                    tenant.tenant_id
                );
            } else {
                smsResult = await smsService.sendRentReminder(
                    tenant.tenant_name,
                    tenant.phone,
                    tenant.house_number,
                    tenant.rent_amount,
                    tenant.due_date,
                    tenant.tenant_id
                );
            }

            if (smsResult.success) {
                sentCount++;
            } else {
                failedCount++;
                errors.push({
                    tenant: tenant.tenant_name,
                    phone: tenant.phone,
                    error: smsResult.error
                });
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        res.json({
            success: true,
            message: `Rent reminders processed`,
            stats: {
                sent: sentCount,
                failed: failedCount,
                total: tenants.length
            },
            errors: failedCount > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Error sending rent reminders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send rent reminders',
            error: error.message
        });
    }
});

/**
 * POST /api/sms/send-payment-confirmation
 * Send payment confirmation to tenant
 * Body: { tenantId, amount, receiptNumber }
 */
router.post('/send-payment-confirmation', async (req, res) => {
    try {
        const { tenantId, amount, receiptNumber } = req.body;

        if (!tenantId || !amount || !receiptNumber) {
            return res.status(400).json({
                success: false,
                message: 'tenantId, amount, and receiptNumber are required'
            });
        }

        const query = `
            SELECT full_name as tenant_name, phone, rent_balance as balance 
            FROM tenants 
            WHERE tenant_id = $1
        `;
        const result = await pool.query(query, [tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        const tenant = result.rows[0];
        const smsResult = await smsService.sendPaymentConfirmation(
            tenant.tenant_name,
            tenant.phone,
            amount,
            receiptNumber,
            tenant.balance,
            tenantId
        );

        res.json(smsResult);

    } catch (error) {
        console.error('Error sending payment confirmation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send payment confirmation',
            error: error.message
        });
    }
});

/**
 * POST /api/sms/send-balance-notification
 * Send balance notification to tenant
 * Body: { tenantId }
 */
router.post('/send-balance-notification', async (req, res) => {
    try {
        const { tenantId } = req.body;

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'tenantId is required'
            });
        }

        const query = `
            SELECT full_name as tenant_name, phone, rent_balance as balance 
            FROM tenants 
            WHERE tenant_id = $1
        `;
        const result = await pool.query(query, [tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        const tenant = result.rows[0];
        const smsResult = await smsService.sendBalanceNotification(
            tenant.tenant_name,
            tenant.phone,
            tenant.balance,
            tenantId
        );

        res.json(smsResult);

    } catch (error) {
        console.error('Error sending balance notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send balance notification',
            error: error.message
        });
    }
});

/**
 * POST /api/sms/send-custom
 * Send custom SMS to specific phone number
 * Body: { phoneNumber, message }
 */
router.post('/send-custom', async (req, res) => {
    try {
        const { phoneNumber, message, tenantId } = req.body;

        if (!phoneNumber || !message) {
            return res.status(400).json({
                success: false,
                message: 'phoneNumber and message are required'
            });
        }

        const result = await smsService.sendSMS(phoneNumber, message, 'custom', tenantId);
        res.json(result);

    } catch (error) {
        console.error('Error sending custom SMS:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send SMS',
            error: error.message
        });
    }
});

/**
 * GET /api/sms/stats
 * Get SMS statistics
 * Query params: startDate, endDate (optional)
 */
router.get('/stats', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const stats = await smsService.getSMSStats(startDate, endDate);
        
        res.json({ 
            success: true, 
            data: stats 
        });
    } catch (error) {
        console.error('Error fetching SMS stats:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * GET /api/sms/tenant-history/:tenantId
 * Get SMS history for a specific tenant
 */
router.get('/tenant-history/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const history = await smsService.getTenantSMSHistory(tenantId);
        
        res.json({ 
            success: true, 
            data: history 
        });
    } catch (error) {
        console.error('Error fetching tenant SMS history:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * GET /api/sms/test
 * Test endpoint to check if SMS service is configured
 */
router.get('/test', async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'SMS service is configured and ready',
            endpoints: {
                'POST /api/sms/send-rent-reminders': 'Send rent reminders (upcoming, due-today, overdue)',
                'POST /api/sms/send-payment-confirmation': 'Send payment confirmation',
                'POST /api/sms/send-balance-notification': 'Send balance notification',
                'POST /api/sms/send-custom': 'Send custom SMS',
                'GET /api/sms/stats': 'Get SMS statistics',
                'GET /api/sms/tenant-history/:tenantId': 'Get tenant SMS history'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;