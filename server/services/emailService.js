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

const STATUS_COLOR = {
  pending: '#6b7280',
  in_review: '#2563eb',
  in_progress: '#d97706',
  resolved: '#059669',
  rejected: '#dc2626'
};

const sendStatusUpdateEmail = async ({ to, name, complaintId, title, status, note }) => {
  const t = getTransporter();
  if (!t || !to) return { skipped: true };

  const friendlyStatus = STATUS_LABEL[status] || status;
  const color = STATUS_COLOR[status] || '#374151';
  const shortId = String(complaintId).slice(-6).toUpperCase();
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  const detailUrl = `${clientUrl.replace(/\/$/, '')}/complaint/${complaintId}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb;">
      <div style="background: #fff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827; margin: 0 0 4px 0;">Hi ${name || 'Citizen'},</h2>
        <p style="color: #6b7280; margin: 0 0 20px 0; font-size: 14px;">
          Your complaint has been updated.
        </p>

        <div style="background: #f3f4f6; padding: 18px; border-radius: 10px; margin: 20px 0;">
          <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Complaint</p>
          <p style="margin: 4px 0 14px 0; font-weight: 600; color: #111827; font-size: 16px;">
            ${title} <span style="color:#9ca3af;font-weight:400;">#${shortId}</span>
          </p>

          <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">New Status</p>
          <p style="margin: 6px 0 0 0;">
            <span style="display:inline-block;padding:6px 12px;background:${color};color:#fff;border-radius:9999px;font-weight:600;font-size:13px;">${friendlyStatus}</span>
          </p>
        </div>

        ${
          note
            ? `<div style="margin:20px 0;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Note from Admin</p>
                <p style="margin: 6px 0 0 0; padding: 12px; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; color: #374151;">${note}</p>
              </div>`
            : ''
        }

        <div style="text-align: center; margin: 28px 0 12px 0;">
          <a href="${detailUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">View Your Complaint</a>
        </div>

        <p style="color: #6b7280; font-size: 13px; margin: 24px 0 0 0; text-align: center;">
          Thank you for helping make your city better.
        </p>
      </div>

      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 16px 0 0 0;">
        — Civic Reporter Team
      </p>
    </div>
  `;

  const textVersion = `Hi ${name || 'Citizen'},

Your complaint "${title}" (#${shortId}) has been updated.

New Status: ${friendlyStatus}
${note ? `Note from Admin: ${note}\n` : ''}
View your complaint: ${detailUrl}

Thank you for helping improve your city.
— Civic Reporter Team`;

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || `"Civic Reporter" <${process.env.SMTP_USER}>`,
      to,
      subject: `Update on your complaint #${shortId} — ${friendlyStatus}`,
      text: textVersion,
      html
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendStatusUpdateEmail };
