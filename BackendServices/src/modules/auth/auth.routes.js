const express = require('express');
const authController = require('./auth.controller');

const router = express.Router();

router.get('/verify-email', authController.verifyEmail);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);
router.post('/send-login-otp', authController.sendLoginOtp);
router.post('/verify-login-otp', authController.verifyLoginOtp);

module.exports = router;

