const mongoose = require("mongoose");

const mailCountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // Ensures one record per user
    },
    successMails: {
      type: Number,
      default: 0,
    },
    failedMails: {
      type: Number,
      default: 0,
    },
  },
  { 
    timestamps: true, 
    versionKey: false // Optional: removes __v field
  }
);

const MailCount = mongoose.model("MailCount", mailCountSchema);

module.exports = MailCount;
