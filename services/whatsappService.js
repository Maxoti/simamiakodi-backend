const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const pool = require('../config/db');

class WhatsAppService {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.qrCode = null;
    }

    initialize() {
        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: "simamiakodi-client"
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        this.client.on('qr', (qr) => {
            console.log('📱 WhatsApp QR Code received, scan with your phone:');
            qrcode.generate(qr, { small: true });
            this.qrCode = qr;
            this.isReady = false;
        });

        this.client.on('ready', () => {
            console.log(' WhatsApp Client is ready!');
            this.isReady = true;
            this.qrCode = null;
        });

        this.client.on('authenticated', () => {
            console.log(' WhatsApp authenticated');
        });

        this.client.on('auth_failure', (msg) => {
            console.error(' WhatsApp authentication failed:', msg);
            this.isReady = false;
        });

        this.client.on('disconnected', (reason) => {
            console.log(' WhatsApp disconnected:', reason);
            this.isReady = false;
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.initialize(), 5000);
        });

        this.client.initialize();
    }

    getStatus() {
        return {
            ready: this.isReady,
            qrCode: this.qrCode
        };
    }

    async sendMessage(phone, message, tenantId = null, messageType = 'general') {
        if (!this.isReady) {
            throw new Error('WhatsApp client is not ready');
        }

        // Format phone number (remove + and spaces)
        let formattedPhone = phone.replace(/[^0-9]/g, '');
        
        // Add country code if not present (Kenya = 254)
        if (!formattedPhone.startsWith('254')) {
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '254' + formattedPhone.substring(1);
            } else if (formattedPhone.startsWith('7')) {
                formattedPhone = '254' + formattedPhone;
            }
        }

        const chatId = formattedPhone + '@c.us';

        try {
            // Send message via WhatsApp
            await this.client.sendMessage(chatId, message);

            // Log to database
            if (tenantId) {
                await pool.query(`
                    INSERT INTO whatsapp_messages (
                        tenant_id, recipient_phone, message_type, 
                        message_text, status, sent_at
                    ) VALUES ($1, $2, $3, $4, $5, NOW())
                `, [tenantId, formattedPhone, messageType, message, 'sent']);
            }

            return {
                success: true,
                phone: formattedPhone
            };
        } catch (error) {
            // Log failed message
            if (tenantId) {
                await pool.query(`
                    INSERT INTO whatsapp_messages (
                        tenant_id, recipient_phone, message_type,
                        message_text, status, error_message
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [tenantId, formattedPhone, messageType, message, 'failed', error.message]);
            }
            throw error;
        }
    }

    formatMoney(amount) {
        if (!amount) return '0.00';
        return parseFloat(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    getNextMonthFirst() {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        date.setDate(1);
        return date.toLocaleDateString();
    }
}

// Create a single instance
const whatsappService = new WhatsAppService();

module.exports = whatsappService;