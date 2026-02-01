const { Resend } = require('resend');
const nodemailer = require('nodemailer');

let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('✅ Resend configured');
}

const sendMail = async (mailOptions) => {
  try {
    // FORCE GMAIL - Check if Gmail credentials exist first
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      // Use Gmail SMTP
      console.log('📧 Sending email via Gmail SMTP...');
      console.log('To:', mailOptions.to);
      console.log('Subject:', mailOptions.subject);
      
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
      
      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent via Gmail');
      return result;
      
    } else if (process.env.RESEND_API_KEY && resend) {
      // Fallback to Resend only if Gmail not configured
      console.log('📧 Sending email via Resend...');
      console.log('To:', mailOptions.to);
      console.log('Subject:', mailOptions.subject);
      
      const result = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html
      });
      
      console.log('✅ Email sent via Resend:', result);
      return result;
    } else {
      throw new Error('No email service configured');
    }
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw error;
  }
};

module.exports = { sendMail };