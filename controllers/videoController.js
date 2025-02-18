const { videoQueue } = require("../config/redis");
const Video = require("../models/Video");

// Submit a video merge job
exports.mergeVideos = async (req, res) => {
  try {
    const { webUrl, camUrl } = req.body;

    if (!webUrl || !camUrl) {
      return res.status(400).json({ error: "Both URLs are required" });
    }

    // Save initial entry in DB
    const video = new Video({ originalUrl: webUrl });
    await video.save();

    // Add job to the queue
    await videoQueue.add("mergeTask", { webUrl, camUrl, videoId: video._id });

    res.status(202).json({ message: "Video processing started", videoId: video._id });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get merged video
exports.getVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: "Video not found" });

    res.json(video);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};
