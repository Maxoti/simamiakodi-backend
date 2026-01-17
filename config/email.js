const nodemailer = require('nodemailer');

// Email transporter configuration
const createTransporter = () => {
  // For production with real email
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    console.log('Configuring email transporter...');
    console.log('Email Host:', process.env.EMAIL_HOST);
    console.log('Email Port:', process.env.EMAIL_PORT);
    console.log('Email User:', process.env.EMAIL_USER);
    console.log('Email Secure:', process.env.EMAIL_SECURE);
    
    const config = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'false', // true for 465, false for 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      // Additional options for better compatibility
      tls: {
        rejectUnauthorized: false
      }
    };
    
    console.log(' Email transporter configured');
    return nodemailer.createTransport(config);
  }
  
  // For development/testing (logs email to console)
  console.warn(' Email credentials not configured. Emails will be logged to console.');
  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true
  });
};

const transporter = createTransporter();

// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error(' Email transporter verification failed:', error);
  } else {
    console.log(' Email server is ready to send messages');
  }
});

module.exports = transporter;