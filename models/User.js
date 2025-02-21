const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    phoneNumber: { type: String, required: true, unique: true }, // Added phone number
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    planDetails: { type: String, default: "NoPlan" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
