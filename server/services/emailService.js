const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials not configured; email notifications disabled.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
};

const STATUS_LABEL = {
  pending: 'Pending',
  in_review: 'In Review',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected'
};

const sendStatusUpdateEmail = async ({ to, name, complaintId, title, status, note }) => {
  const t = getTransporter();
  if (!t || !to) return { skipped: true };

  const friendlyStatus = STATUS_LABEL[status] || status;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937;">Hi ${name || 'Citizen'},</h2>
      <p style="color: #374151; font-size: 16px;">
        Your complaint has been updated:
      </p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Complaint ID</p>
        <p style="margin: 4px 0 12px; font-weight: 600;">#${String(complaintId).slice(-6).toUpperCase()}</p>
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Title</p>
        <p style="margin: 4px 0 12px; font-weight: 600;">${title}</p>
        <p style="margin: 0; font-size: 14px; color: #6b7280;">New Status</p>
        <p style="margin: 4px 0 12px; font-weight: 600; color: #2563eb;">${friendlyStatus}</p>
        ${note ? `<p style="margin: 0; font-size: 14px; color: #6b7280;">Note from Admin</p>
        <p style="margin: 4px 0;">${note}</p>` : ''}
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        Thank you for helping make your city better.
      </p>
      <p style="color: #6b7280; font-size: 12px;">— Civic Reporter Team</p>
    </div>
  `;

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || `"Civic Reporter" <${process.env.SMTP_USER}>`,
      to,
      subject: `Update on your complaint: ${friendlyStatus}`,
      html
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendStatusUpdateEmail };
