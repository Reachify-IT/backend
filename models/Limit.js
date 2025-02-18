const mongoose = require("mongoose");

const LimitSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      required: true,
    },
    limit: {
      type: Number,
      required: true,
      max: 280,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Limit", LimitSchema);
