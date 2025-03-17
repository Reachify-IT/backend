const mongoose = require("mongoose");


const mailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  email: { type: String, required: true, unique: true },
  accessToken: String,
  refreshToken: String,
  dailyEmailCount: {
    date: { type: Date, default: Date.now },
    count: { type: Number, default: 0 }
  },
  totalSentDays: { type: Number, default: 0 },
});

module.exports = mongoose.model("mailSchema", mailSchema);
