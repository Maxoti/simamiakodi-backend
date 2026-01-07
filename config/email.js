const nodemailer = require('nodemailer');

// Email transporter configuration
const createTransporter = () => {
  // For production with real email
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail', // or 'outlook', 'yahoo', etc.
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
  
  // For development/testing (logs email to console)
  console.warn('  Email credentials not configured. Emails will be logged to console.');
  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true
  });
};

const transporter = createTransporter();

module.exports = transporter;