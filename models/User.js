const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, index: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    phoneNumber: { type: String, required: false, unique: true },
    password: { type: String, required: false, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    planDetails: {
      type: String,
      enum: ["Trial", "Starter", "Pro", "Enterprise"], // Added "Trial"
      default: "Trial", // New users start with "Trial"
    },
    trialEndDate: { type: Date }, // Store trial expiration date

    videosCount: { type: Number, default: 0 }, // Tracks stored videos per user

    videoPreference: {
      type: String,
      enum: ["storeOnly", "instantMail"],
      default: "storeOnly",
    },

    cameraSettings: {
      position: {
        type: String,
        enum: ["top-left", "top-right", "bottom-left", "bottom-right"],
        default: "top-left",
      },
      size: {
        type: String,
        enum: ["small", "medium", "large", "extra-large"],
        default: "medium",
      },
    },

    // ✅ Payment history array to store all transactions
    paymentHistory: [
      {
        orderId: { type: String, required: true },
        amount: { type: Number, required: true },
        status: {
          type: String,
          enum: ["PENDING", "ACTIVE", "PAID", "TERMINATED"],
          default: "PENDING",
        },
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
