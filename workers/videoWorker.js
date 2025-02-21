require("dotenv").config();
const { Queue, Worker, QueueEvents } = require("bullmq");
const Redis = require("ioredis");
const path = require("path");
const os = require("os");
const fs = require("fs");
const express = require("express");

const processExcel = require("../utils/processExcel");
const recordWebsite = require("../utils/recordWebsite");
const mergeVideos = require("../utils/mergeVideos");
const uploadToS3 = require("../utils/uploadToS3");
const Video = require("../models/Video");

const router = express.Router();

// ✅ Max CPU Utilization (Leaves 1 core free)
const maxConcurrency = Math.max(1, os.cpus().length - 1);
let terminationRequested = false;

// ✅ Optimized Redis Connection
const redisConnection = new Redis(process.env.REDIS_URL, {
  tls: { rejectUnauthorized: false },
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  reconnectOnError: (err) => {
    console.error("❌ Redis Connection Error:", err.message);
    return true;
  },
});

// ✅ BullMQ Queue
const videoQueue = new Queue("videoProcessing", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

// ✅ Queue Events (for tracking job status)
const queueEvents = new QueueEvents("videoProcessing", {
  connection: redisConnection,
});

const completedJobs = new Map();
let io;

// ✅ Track Job Completion with Socket.io
queueEvents.on("completed", async ({ jobId, returnvalue }) => {
  if (!io) io = getIoInstance();
  console.log(`✅ Job ${jobId} completed.`);
  completedJobs.set(jobId, returnvalue);
  io.emit("jobCompleted", { jobId, urls: returnvalue });
});

// ✅ File Deletion Utility
const deleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error(`❌ Error deleting file ${filePath}:`, err);
      else console.log(`🗑️ Deleted file: ${filePath}`);
    });
  }
};

// ✅ Video Processing Worker
const videoWorker = new Worker(
  "videoProcessing",
  async (job) => {
    if (terminationRequested) {
      console.log(`🛑 Job ${job.id} skipped due to termination.`);
      return;
    }

    const startTime = Date.now();
    console.log(`Processing job ${job.id}...`);
    if (!io) io = getIoInstance();
    io.emit("jobStarted", { jobId: job.id });

    const { excelPath, camVideoPath, userId } = job.data;
    if (!userId) throw new Error("❌ Missing userId in job data.");

    console.log(`🔍 Processing Excel File: ${excelPath}`);
    const websiteUrls = processExcel(excelPath);

    if (websiteUrls.length === 0) {
      console.error("❌ No valid URLs found in the Excel file");
      return; // Stop further execution
    }

    const outputDir = path.join(__dirname, "../uploads/");
    const maxConcurrentTabs = 5;
    let recordedVideos = [];

    for (let i = 0; i < websiteUrls.length; i += maxConcurrentTabs) {
      if (terminationRequested) {
        console.log(`🛑 Job ${job.id} stopped early due to termination.`);
        break;
      }
      const chunk = websiteUrls.slice(i, i + maxConcurrentTabs);
      console.log(`🎥 Processing batch of ${chunk.length} websites...`);

      const chunkResults = await Promise.all(
        chunk.map(async (webUrl) => {
          try {
            return { webUrl, path: await recordWebsite(webUrl, outputDir) };
          } catch (err) {
            console.error(`❌ Failed to record ${webUrl}:`, err.message);
            return null;
          }
        })
      );

      recordedVideos.push(...chunkResults.filter(Boolean));
      io.emit("jobProgress", {
        jobId: job.id,
        progress: (i + chunk.length) / websiteUrls.length,
      });
    }

    console.log(
      "✅ All websites recorded successfully:",
      recordedVideos.length
    );
    if (recordedVideos.length === 0)
      throw new Error("❌ No recordings succeeded.");

    const mergedVideos = [];
    const timestamp = Date.now();

    for (const { webUrl, path: webVideo } of recordedVideos) {
      const outputFilePath = `./uploads/merged_${timestamp}.mp4`;
      try {
        console.log("🔄 Merging videos...");
        await mergeVideos(webVideo, camVideoPath, outputFilePath);

        console.log("☁️ Uploading to S3...");
        const s3Url = await uploadToS3(
          outputFilePath,
          `merged_${timestamp}.mp4`
        );
        mergedVideos.push(s3Url);

        console.log(`✅ Video uploaded to S3: ${s3Url}`);
      } catch (mergeError) {
        console.error(
          `❌ Merging or Uploading Failed for ${webUrl}:`,
          mergeError.message
        );
      }
      deleteFile(webVideo);
      deleteFile(outputFilePath);
    }

    deleteFile(excelPath);
    deleteFile(camVideoPath);

    if (mergedVideos?.length > 0) {
      try {
        const videoRecords = recordedVideos.map(({ webUrl }, index) => ({
          websiteUrl: webUrl,
          mergedUrl: mergedVideos[index] || null, // Ensure mapping even if an upload fails
        }));

        await Video.create({
          userId,
          videos: videoRecords, // Store mapping directly
        });

        console.log("✅ Website URLs mapped to AWS links and saved in DB!");
      } catch (dbError) {
        console.error("❌ MongoDB Save Error:", dbError);
      }
    } else {
      console.warn("⚠️ No videos were processed. Skipping DB save.");
    }

    console.log(
      `✅ Job ${job.id} completed in ${(Date.now() - startTime) / 1000} seconds`
    );
    io.emit("jobCompleted", { jobId: job.id, urls: mergedVideos });
    return mergedVideos;
  },
  { connection: redisConnection, concurrency: maxConcurrency }
);




// ✅ Function to terminate processing
const terminateProcessing = async () => {
  try {
    console.log("🛑 Termination Requested!");
    terminationRequested = true;
    io.emit("terminationRequested");

    if (videoWorker) {
      await videoWorker.close();
      console.log("✅ Worker closed.");
    }

    if (redisConnection && redisConnection.status === "ready") {
      await redisConnection.quit();
      console.log("✅ Redis connection closed.");
    }
  } catch (error) {
    console.error("❌ Error during termination:", error);
  }
};

// ✅ Redis Event Listeners
redisConnection.on("connect", () => console.log("✅ Redis connected!"));
redisConnection.on("error", (err) =>
  console.error("❌ Redis connection error:", err)
);

module.exports = {
  videoQueue,
  videoWorker,
  terminateProcessing,
  completedJobs,
};
