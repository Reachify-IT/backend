const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    phoneNumber: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    planDetails: { 
      type: String, 
      enum: ["Silver", "Gold", "Diamond"], 
      default: "Silver" 
    },
    videosCount: { type: Number, default: 0 }, // Tracks stored videos per user

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
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
