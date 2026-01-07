// services/smsService.js
// Mobiwave SMS Service for SimamiaKodi Rent Management System

const axios = require('axios');
const pool = require('../config/db'); // Your PostgreSQL pool

class MobiwaveSMS {
    constructor() {
        this.apiToken = '1776|8r56donzdYy3I9tCleS6nzKNJtCEbvQP16IHs2XM7427a4af';
        this.baseUrl = 'https://sms.mobiwave.co.ke/api/v3';
        this.senderId = 'SIMAMIA';
        this.costPerSMS = 1.50; // Update with actual cost from Mobiwave
    }

    /**
     * Format phone number to 254 format
     */
    formatPhoneNumber(phone) {
        phone = phone.replace(/\D/g, '');
        if (phone.startsWith('0')) {
            phone = '254' + phone.substring(1);
        }
        if (!phone.startsWith('254')) {
            phone = '254' + phone;
        }
        return phone;
    }

    /**
     * Send SMS to a single recipient
     */
    async sendSMS(phoneNumber, message, messageType = 'custom', tenantId = null) {
        try {
            phoneNumber = this.formatPhoneNumber(phoneNumber);
            
            const response = await axios.post(
                `${this.baseUrl}/sms/send`,
                {
                    recipient: phoneNumber,
                    sender_id: this.senderId,
                    message: message,
                    type: 'plain'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );

            // Log to database
            await this.logSMS({
                tenantId,
                phoneNumber,
                messageType,
                messageContent: message,
                status: 'sent',
                mobiwaveResponse: response.data,
                cost: this.costPerSMS
            });

            return {
                success: true,
                data: response.data,
                status: response.status
            };
        } catch (error) {
            console.error('SMS Send Error:', error.response?.data || error.message);
            
            // Log failure
            await this.logSMS({
                tenantId,
                phoneNumber,
                messageType,
                messageContent: message,
                status: 'failed',
                errorMessage: error.response?.data?.message || error.message,
                mobiwaveResponse: error.response?.data
            });

            return {
                success: false,
                error: error.response?.data?.message || error.message,
                status: error.response?.status
            };
        }
    }

    /**
     * Log SMS to database
     */
    async logSMS(data) {
        const query = `
            INSERT INTO sms_logs 
            (tenant_id, phone_number, message_type, message_content, status, error_message, mobiwave_response, cost)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING sms_id
        `;
        
        try {
            await pool.query(query, [
                data.tenantId,
                data.phoneNumber,
                data.messageType,
                data.messageContent,
                data.status,
                data.errorMessage || null,
                JSON.stringify(data.mobiwaveResponse || {}),
                data.cost || this.costPerSMS
            ]);
        } catch (error) {
            console.error('Error logging SMS:', error);
        }
    }

    /**
     * Send rent reminder (before due date)
     */
    async sendRentReminder(tenantName, phoneNumber, houseNumber, amount, dueDate, tenantId) {
        const message = `Dear ${tenantName}, this is a reminder that rent for House ${houseNumber} of KES ${amount.toLocaleString()} is due on ${dueDate}. Pay via M-PESA to avoid penalties. SimamiaKodi`;
        
        return await this.sendSMS(phoneNumber, message, 'rent_reminder', tenantId);
    }

    /**
     * Send overdue rent notice
     */
    async sendOverdueNotice(tenantName, phoneNumber, houseNumber, amount, daysOverdue, tenantId) {
        const message = `Dear ${tenantName}, your rent for House ${houseNumber} of KES ${amount.toLocaleString()} is ${daysOverdue} day(s) overdue. Please pay immediately to avoid further action. SimamiaKodi`;
        
        return await this.sendSMS(phoneNumber, message, 'overdue_notice', tenantId);
    }

    /**
     * Send payment confirmation
     */
    async sendPaymentConfirmation(tenantName, phoneNumber, amount, receiptNumber, balance, tenantId) {
        let message = `Dear ${tenantName}, we confirm receipt of KES ${amount.toLocaleString()}. Receipt No: ${receiptNumber}.`;
        
        if (balance > 0) {
            message += ` Balance: KES ${balance.toLocaleString()}.`;
        } else {
            message += ` Account fully paid.`;
        }
        
        message += ` Thank you! SimamiaKodi`;
        
        return await this.sendSMS(phoneNumber, message, 'payment_confirmation', tenantId);
    }

    /**
     * Send balance notification
     */
    async sendBalanceNotification(tenantName, phoneNumber, balance, tenantId) {
        const message = balance > 0 
            ? `Dear ${tenantName}, your rent balance is KES ${balance.toLocaleString()}. Please clear to avoid penalties. For inquiries: 0790394977. SimamiaKodi`
            : `Dear ${tenantName}, your rent account is fully paid. Thank you! SimamiaKodi`;
        
        return await this.sendSMS(phoneNumber, message, 'balance_notification', tenantId);
    }

    /**
     * Get SMS statistics
     */
    async getSMSStats(startDate = null, endDate = null) {
        let query = `
            SELECT 
                message_type,
                status,
                COUNT(*) as count,
                SUM(cost) as total_cost
            FROM sms_logs
        `;
        
        const params = [];
        if (startDate && endDate) {
            query += ` WHERE sent_date BETWEEN $1 AND $2`;
            params.push(startDate, endDate);
        }
        
        query += ` GROUP BY message_type, status ORDER BY message_type, status`;
        
        const result = await pool.query(query, params);
        return result.rows;
    }

    /**
     * Get SMS history for a tenant
     */
    async getTenantSMSHistory(tenantId) {
        const query = `
            SELECT 
                sms_id,
                phone_number,
                message_type,
                message_content,
                status,
                cost,
                sent_date
            FROM sms_logs
            WHERE tenant_id = $1
            ORDER BY sent_date DESC
            LIMIT 50
        `;
        
        const result = await pool.query(query, [tenantId]);
        return result.rows;
    }
}

module.exports = MobiwaveSMS;