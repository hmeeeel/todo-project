const nodemailer = require('nodemailer');
const logger = require('./logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465, // true для порта 465, false для остальных
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendPasswordResetCode(toEmail, code) {
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: 'Код для сброса пароля',
    text: `код для сброса пароля: ${code}\n\nКод действителен 15 минут.`
  });

  logger.info('password_reset_email_sent', { to: toEmail, messageId: info.messageId });
}
module.exports = { sendPasswordResetCode };