const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Present for password-based accounts; absent for Google-only accounts.
    passwordHash: { type: String },
    name: { type: String, default: '' },
    emailVerified: { type: Boolean },
    authProvider: { type: String, default: 'password', enum: ['password', 'google'] },
    googleSub: { type: String, index: true, sparse: true },
    verificationToken: { type: String, select: false },
    verificationExpires: { type: Date, select: false },
    loginOtpHash: { type: String, select: false },
    loginOtpExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);

