const mongoose = require("mongoose");

const googleMailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Link to User
  email: { type: String, required: true, unique: true },
  googleRefreshToken: { type: String, required: true }, // Store refresh token
  googleAccessToken: { type: String, required: false }, // Store latest access token
  dailyEmailCount: {
    date: { type: Date, default: Date.now },  // Track the last email sent date
    count: { type: Number, default: 0 }  // How many emails sent today
  },
  totalSentDays: { type: Number, default: 0 },
});

module.exports = mongoose.model("GoogleMail", googleMailSchema); // ✅ Correct model name
