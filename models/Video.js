const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", required: true },
    videos: [
      {
        websiteUrl: { type: String, required: true },
        mergedUrl: { type: String, required: true },
        createdAt: { type: Date, default: () => new Date() },
        email: { type: String, required: true },
        name: { type: String, required: true },
        clientCompany: { type: String, required: true },
        clientDesignation: { type: String, required: true },
      },
    ],
  },
  { timestamps: true } // Adds createdAt and updatedAt fields
);

const Video = mongoose.model("Video", videoSchema);
module.exports = Video;
