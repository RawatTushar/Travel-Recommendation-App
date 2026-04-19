const nodemailer = require('nodemailer');

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host || !String(host).trim()) {
    return null;
  }
  return nodemailer.createTransport({
    host: host.trim(),
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendVerificationEmail({ to, verifyUrl, name }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'Wander <noreply@localhost>';
  const subject = 'Confirm your Wander account';
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;">
<p>${greeting}</p>
<p>Thanks for signing up. Confirm your email to activate your account:</p>
<p><a href="${escapeHtml(verifyUrl)}">Confirm email address</a></p>
<p style="color:#666;font-size:14px;">If the button does not work, copy this link into your browser:<br/>${escapeHtml(
    verifyUrl,
  )}</p>
</body></html>`;

  const transport = createTransport();
  if (!transport) {
    console.log('\n[email] SMTP not set (see .env). Verification link for', to, ':\n', verifyUrl, '\n');
    return;
  }

  await transport.sendMail({
    from,
    to,
    subject,
    html,
    text: `Confirm your email: ${verifyUrl}`,
  });
}

async function sendLoginOtpEmail({ to, otpCode, name }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'Wander <noreply@localhost>';
  const subject = 'Your Wander login OTP';
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;">
<p>${greeting}</p>
<p>Use this one-time code to sign in to Wander:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px;">${escapeHtml(otpCode)}</p>
<p style="color:#666;font-size:14px;">This code expires in 10 minutes.</p>
</body></html>`;

  const transport = createTransport();
  if (!transport) {
    console.log('\n[email] SMTP not set (see .env). Login OTP for', to, ':\n', otpCode, '\n');
    return;
  }

  await transport.sendMail({
    from,
    to,
    subject,
    html,
    text: `Your Wander login OTP is ${otpCode}. It expires in 10 minutes.`,
  });
}

module.exports = { sendVerificationEmail, sendLoginOtpEmail };

