require("dotenv").config();
const { Queue, Worker } = require("bullmq");
const Redis = require("ioredis");
const path = require("path");
const os = require("os");
const fs = require("fs");

const processExcel = require("../utils/processExcel");
const recordWebsite = require("../utils/recordWebsite");
const mergeVideos = require("../utils/mergeVideos");
const uploadToS3 = require("../utils/uploadToS3");
const Video = require("../models/Video");

const maxConcurrency = os.cpus().length - 1;

// ✅ Redis Connection
const redisConnection = new Redis(process.env.REDIS_URL, {
  tls: { rejectUnauthorized: false },
  maxRetriesPerRequest: null,
});

// ✅ BullMQ Queue
const videoQueue = new Queue("videoProcessing", {
  connection: redisConnection,
});

// ✅ Function to delete a file
const deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`❌ Error deleting file ${filePath}:`, err);
    } else {
      console.log(`🗑️ Deleted file: ${filePath}`);
    }
  });
};

const videoWorker = new Worker(
  "videoProcessing",
  async (job) => {
    const startTime = Date.now();
    console.log(`Processing job ${job.id}...`);

    const { excelPath, camVideoPath, userId } = job.data;

    if (!userId) {
      throw new Error("❌ Missing userId in job data.");
    }

    console.log(`🔍 Processing Excel File: ${excelPath}`);
    const websiteUrls = processExcel(excelPath);
    if (websiteUrls.length === 0) {
      throw new Error("❌ No valid URLs found in the Excel file");
    }

    const outputDir = path.join(__dirname, "../uploads/");
    const recordedVideos = [];

    for (const webUrl of websiteUrls) {
      console.log(`🎥 Recording website: ${webUrl}`);
      const recordedVideoPath = await recordWebsite(webUrl, outputDir);
      recordedVideos.push({ webUrl, path: recordedVideoPath });
    }

    console.log("✅ All websites recorded successfully:", recordedVideos);

    const mergedVideos = [];

    for (const { webUrl, path: webVideo } of recordedVideos) {
      const outputFilePath = `./uploads/merged_${Date.now()}.mp4`;

      console.log("🔄 Merging videos...");
      await mergeVideos(webVideo, camVideoPath, outputFilePath);

      console.log("☁️ Uploading to S3...");
      const fileName = `merged_${Date.now()}.mp4`;
      const s3Url = await uploadToS3(outputFilePath, fileName);

      console.log(`✅ Video uploaded to S3: ${s3Url}`);

      // Push the URL to the array
      mergedVideos.push(s3Url);

      // ✅ Delete local files after processing
      deleteFile(webVideo);
      deleteFile(outputFilePath);
    }

    // ✅ Delete the uploaded Excel file and Camera Video after processing
    deleteFile(excelPath);
    deleteFile(camVideoPath);

    // ✅ After processing all videos, save to MongoDB in a single operation
    if (mergedVideos.length > 0) {
      try {
        const newVideo = await Video.create({
          userId,
          mergedUrls: mergedVideos, // Saving all merged video URLs as an array
        });

        console.log("✅ Video details saved in DB!", newVideo);
      } catch (dbError) {
        console.error("❌ MongoDB Save Error:", dbError);
      }
    } else {
      console.warn("⚠️ No videos were processed. Skipping DB save.");
    }

    const endTime = Date.now();
    console.log(
      `✅ Job ${job.id} completed in ${(endTime - startTime) / 1000} seconds`
    );

    return mergedVideos;
  },
  { connection: redisConnection, concurrency: maxConcurrency }
);

// ✅ Job Status Listeners
videoWorker.on("active", (job) =>
  console.log(`🚀 Job ${job.id} is now being processed`)
);
videoWorker.on("completed", (job) =>
  console.log(`✅ Job ${job.id} completed:`, job.returnvalue)
);
videoWorker.on("failed", (job, err) =>
  console.error(`❌ Job ${job.id} failed:`, err)
);

// ✅ Redis Event Listeners
redisConnection.on("connect", () => console.log("✅ Redis connected!"));
redisConnection.on("error", (err) =>
  console.error("❌ Redis connection error:", err)
);

module.exports = { videoQueue, videoWorker };
