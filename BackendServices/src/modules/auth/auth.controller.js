const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('./auth.model');
const { sendVerificationEmail, sendLoginOtpEmail } = require('../../shared/services/email/email.service');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 10;
const VERIFY_HOURS = Number(process.env.VERIFICATION_EXPIRE_HOURS || 48);
const OTP_MINUTES = Number(process.env.LOGIN_OTP_EXPIRE_MINUTES || 10);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID; // Web client ID audience
const googleClient = new OAuth2Client();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name || '',
  };
}

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );
}

const register = async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const emailNorm = normalizeEmail(email);
    const existing = await User.findOne({ email: emailNorm });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    const passwordHash = await bcrypt.hash(String(password), SALT_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + VERIFY_HOURS * 60 * 60 * 1000);

    const user = await User.create({
      email: emailNorm,
      passwordHash,
      name: name != null ? String(name).trim() : '',
      emailVerified: false,
      verificationToken,
      verificationExpires,
    });

    const publicBase = (process.env.PUBLIC_API_BASE_URL || 'http://192.168.1.2:4000').replace(/\/$/, '');
    const verifyUrl = `${publicBase}/api/auth/verify-email?token=${encodeURIComponent(verificationToken)}`;

    setImmediate(() => {
      sendVerificationEmail({
        to: user.email,
        verifyUrl,
        name: user.name,
      }).catch((e) => console.error('[email] verification send failed:', e.message));
    });

    return res.status(201).json({
      success: true,
      needsVerification: true,
      message: 'Check your email for a confirmation link to finish signing up.',
      user: toPublicUser(user),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    console.error('register', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const token = req.query.token;
    if (!token || typeof token !== 'string') {
      res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send('<h1>Invalid link</h1><p>Missing confirmation token.</p>');
    }

    const updateResult = await User.updateOne(
      {
        verificationToken: token,
        verificationExpires: { $gt: new Date() },
      },
      {
        $set: { emailVerified: true },
        $unset: { verificationToken: '', verificationExpires: '' },
      },
    );

    if (updateResult.matchedCount === 0) {
      res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(
        '<h1>Link expired or invalid</h1><p>Request a new confirmation email from the app or register again.</p>',
      );
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(
      '<h1>Email confirmed</h1><p>You can close this page and sign in to the Wander app.</p>',
    );
  } catch (err) {
    console.error('verifyEmail', err);
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send('<h1>Error</h1><p>Something went wrong. Try again later.</p>');
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (!user.passwordHash) {
      return res.status(409).json({
        success: false,
        message: 'This account uses Google sign-in. Tap “Continue with Gmail”.',
      });
    }
    if (user.emailVerified === false) {
      return res.status(403).json({
        success: false,
        message: 'Please confirm your email using the link we sent you, then try signing in.',
      });
    }
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const token = signToken(user);
    return res.json({
      success: true,
      token,
      user: toPublicUser(user),
    });
  } catch (err) {
    console.error('login', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const sendLoginOtp = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email: normalizeEmail(email) }).select('+loginOtpHash +loginOtpExpires');
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found for this email' });
    }
    if (user.emailVerified === false) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email first, then try OTP login.',
      });
    }

    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const loginOtpHash = await bcrypt.hash(otpCode, SALT_ROUNDS);
    const loginOtpExpires = new Date(Date.now() + OTP_MINUTES * 60 * 1000);

    user.loginOtpHash = loginOtpHash;
    user.loginOtpExpires = loginOtpExpires;
    await user.save();

    try {
      await sendLoginOtpEmail({
        to: user.email,
        otpCode,
        name: user.name,
      });
    } catch (mailErr) {
      user.loginOtpHash = undefined;
      user.loginOtpExpires = undefined;
      await user.save();
      console.error('[email] otp send failed:', mailErr.message);
      return res.status(502).json({
        success: false,
        message: 'Unable to send OTP email right now. Please check SMTP settings and try again.',
      });
    }

    return res.json({
      success: true,
      message: 'OTP sent to your email',
    });
  } catch (err) {
    console.error('sendLoginOtp', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email: normalizeEmail(email) }).select('+loginOtpHash +loginOtpExpires');
    if (!user || !user.loginOtpHash || !user.loginOtpExpires) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }

    if (user.loginOtpExpires <= new Date()) {
      user.loginOtpHash = undefined;
      user.loginOtpExpires = undefined;
      await user.save();
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const ok = await bcrypt.compare(String(otp), user.loginOtpHash);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.loginOtpHash = undefined;
    user.loginOtpExpires = undefined;
    await user.save();

    const token = signToken(user);
    return res.json({
      success: true,
      token,
      user: toPublicUser(user),
    });
  } catch (err) {
    console.error('verifyLoginOtp', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ success: false, message: 'idToken is required' });
    }
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: 'Server is missing GOOGLE_CLIENT_ID configuration',
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ success: false, message: 'Invalid Google token' });
    }

    const email = normalizeEmail(payload.email);
    const googleSub = payload.sub;
    const name = payload.name || payload.given_name || '';

    if (!email || !googleSub) {
      return res.status(401).json({ success: false, message: 'Google token missing email/sub' });
    }

    // Find existing by email first (allow linking), then by sub.
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.findOne({ googleSub });
    }

    if (!user) {
      return res.status(403).json({
        success: false,
        registered: false,
        needsRegistration: true,
        email,
        name: String(name || '').trim(),
        message: 'No account for this Google email. Create an account to continue.',
      });
    }

    const update = {};
    if (!user.googleSub) update.googleSub = googleSub;
    if (!user.authProvider || user.authProvider === 'password') update.authProvider = 'google';
    if (user.emailVerified === false) update.emailVerified = true;
    if (!user.name && name) update.name = String(name).trim();
    if (Object.keys(update).length > 0) {
      user = await User.findByIdAndUpdate(user._id, { $set: update }, { new: true });
    }

    const token = signToken(user);
    return res.json({
      success: true,
      registered: true,
      token,
      user: toPublicUser(user),
    });
  } catch (err) {
    console.error('googleLogin', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  googleLogin,
  sendLoginOtp,
  verifyLoginOtp,
};

