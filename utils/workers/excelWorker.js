const { Worker } = require("bullmq");
const recordWebsite = require("../utils/recordWebsite");
const mergeVideos = require("../utils/mergeVideos");
const uploadToS3 = require("../utils/uploadToS3");
const Video = require("../models/Video");

const videoWorker = new Worker(
  "videoProcessing",
  async (job) => {
    const { webUrl, camUrl } = job.data;
    const outputFilePath = `./uploads/merged_${Date.now()}.mp4`;

    try {
      console.log(`🎥 Recording website: ${webUrl}`);
      const webVideo = await recordWebsite(webUrl, "./uploads");

      console.log("🔄 Merging videos...");
      await mergeVideos(webVideo, camUrl, outputFilePath);

      console.log("☁️ Uploading to S3...");
      const s3Url = await uploadToS3(outputFilePath, `merged_${Date.now()}.mp4`);

      console.log(`✅ Video processed: ${s3Url}`);

      await Video.create({ originalUrl: webUrl, mergedUrl: s3Url });
    } catch (error) {
      console.error("❌ Video Processing Error:", error);
    }
  }
);

module.exports = videoWorker;
