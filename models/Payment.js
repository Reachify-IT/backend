const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    planDetails: {
      type: String,
      enum: ["Starter", "Pro", "Enterprise"],
      default: "Starter",
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    referenceId: { type: String }, // Cashfree transaction reference
    paymentMethod: { type: String }, // ✅ Added to track payment type (UPI, card, etc.)
    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "PAID", "TERMINATED"],
      default: "PENDING",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);
