const User = require("../models/User");
const Otp = require("../models/otpSchema");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const bcrypt = require("bcryptjs");

// Setup Nodemailer


const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Twilio setup
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);


const generateOtp = (length = 6) => {
    const buffer = crypto.randomBytes(length);
    let otp = '';

    for (let i = 0; i < length; i++) {
        otp += (buffer[i] % 10).toString(); // Ensures each digit is between 0-9
    }

    return otp;
};

// 📌 **Send OTP to Email**
exports.sendEmailOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const otp = generateOtp();
        const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

        await Otp.create({ email, otp, otpExpiry });

        // Send OTP via email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Verify Your Email (OTP)",
            text: `Your OTP is: ${otp}`
        });

        res.status(200).json({ 
            success: true,
            message: "OTP sent to email" });

    } catch (error) {
        console.error("Send Email OTP Error:", error);
        res.status(500).json({ message: "Failed to send OTP" });
    }
};

// 📌 **Send OTP to Phone**
exports.sendPhoneOtp = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) return res.status(400).json({ message: "Phone number is required" });

        const otp = generateOtp();
        const otpExpiry = Date.now() + 10 * 60 * 1000;

        await Otp.create({ phoneNumber, otp, otpExpiry });

        // Send OTP via SMS using Twilio
        await twilioClient.messages.create({
            body: `Your OTP is: ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: `+ ${phoneNumber}`
        });

        res.status(200).json({ message: "OTP sent to phone" });

    } catch (error) {
        console.error("Send Phone OTP Error:", error);
        res.status(500).json({ message: "Failed to send OTP" });
    }
};

// 📌 **Verify Email OTP**
exports.verifyEmailOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

        const otpRecord = await Otp.findOne({ email, otp });

        if (!otpRecord) return res.status(400).json({ message: "Invalid OTP" });
        if (Date.now() > otpRecord.otpExpiry) return res.status(400).json({ message: "OTP expired" });

        // Mark OTP as verified
        await Otp.deleteOne({ email });

        res.status(200).json({
             success: true,
             message: "Email verified successfully"
         });

    } catch (error) {
        console.error("Verify Email OTP Error:", error);
        res.status(500).json({ message: "OTP verification failed" });
    }
};

// 📌 **Verify Phone OTP**
exports.verifyPhoneOtp = async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;
        if (!phoneNumber || !otp) return res.status(400).json({ message: "Phone number and OTP are required" });

        const otpRecord = await Otp.findOne({ phoneNumber, otp });

        if (!otpRecord) return res.status(400).json({ message: "Invalid OTP" });
        if (Date.now() > otpRecord.otpExpiry) return res.status(400).json({ message: "OTP expired" });

        // Mark OTP as verified
        await Otp.deleteOne({ phoneNumber });

        // Update user verification status
        await User.findOneAndUpdate({ phoneNumber }, { isPhoneVerified: true });

        res.status(200).json({
            success: true,
            message: "Phone verified successfully"
        });

    } catch (error) {
        console.error("Verify Phone OTP Error:", error);
        res.status(500).json({ message: "OTP verification failed" });
    }
};
