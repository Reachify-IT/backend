const mongoose = require("mongoose");

const UploadSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      required: true,
      max: 280,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Upload", UploadSchema);
