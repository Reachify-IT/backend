const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  videos: [
    {
      websiteUrl: { type: String, required: true }, // Website URL from Excel
      mergedUrl: { type: String, required: true }, // Corresponding merged video URL
    }
  ],
  createdAt: { type: Date, default: Date.now },
});

const Video = mongoose.model("Video", videoSchema);
module.exports = Video;
