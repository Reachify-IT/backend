const mongoose = require("mongoose");

const imapschema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  imapHost: { type: String, required: true },
  imapPort: { type: Number, required: true },
  smtpHost: { type: String, required: true },
  smtpPort: { type: Number, required: true },
  replyTo: { type: String, required: true },
  dailyEmailCount: {
    date: { type: Date, default: Date.now },
    count: { type: Number, default: 0 }
  },
  totalSentDays: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("imapschema", imapschema);


