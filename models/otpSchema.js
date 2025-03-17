const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
    email: { type: String, default: null },
    phoneNumber: { type: String, default: null },
    otp: { type: String, required: true },
    otpExpiry: { type: Date, required: true },
    verified: { type: Boolean, default: false }
});

module.exports = mongoose.model("Otp", otpSchema);
