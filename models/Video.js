const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  mergedUrls: [{ type: String, required: true }], // Storing merged video URLs as an array
  createdAt: { type: Date, default: Date.now },
});

const Video = mongoose.model("Video", videoSchema);
module.exports = Video;
