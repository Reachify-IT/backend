const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    planDetails: {
      type: String,
      enum: ["Trial", "Starter", "Pro", "Enterprise"], // Added "Trial"
      default: "Trial", // New users start with "Trial"
    },
    trialEndDate: { type: Date }, // Store trial expiration date

    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    referenceId: { type: String }, // Cashfree transaction reference
    paymentMethod: { type: String }, // ✅ Added to track payment type (UPI, card, etc.)
    transactionId: { type: String },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "CANCELLED"],
      default: "PENDING",
    },
    orderStatus: {
      type: String,
      enum: ["PENDING", "ACTIVE", "PAID", "TERMINATED"],
      default: "PENDING",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);
