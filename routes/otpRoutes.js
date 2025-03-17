const express = require("express");
const {
    sendEmailOtp,
    sendPhoneOtp,
    verifyEmailOtp,
    verifyPhoneOtp
} = require("../controllers/otpController");

const router = express.Router();

router.post("/send-email-otp", sendEmailOtp);
router.post("/send-phone-otp", sendPhoneOtp);
router.post("/verify-email-otp", verifyEmailOtp);
router.post("/verify-phone-otp", verifyPhoneOtp);

module.exports = router;
