const mongoose = require("mongoose");

const mailCountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  successMails: {
    type: Number,
    default: 0, // Default count is zero
  },
  failedMails: {
    type: Number,
    default: 0, // Default count is zero
  },
}, { timestamps: true });

const MailCount = mongoose.model("mailCount", mailCountSchema);

module.exports = MailCount;
