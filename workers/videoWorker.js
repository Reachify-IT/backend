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
const User = require("../models/User");

const router = express.Router();

const maxConcurrency = Math.max(1, os.cpus().length - 1);
let terminationRequested = false;

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

const videoQueue = new Queue("videoProcessing", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: true,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

const queueEvents = new QueueEvents("videoProcessing", {
  connection: redisConnection,
});
const completedJobs = new Map();

queueEvents.on("completed", async ({ jobId, returnvalue }) => {
  console.log(`✅ Job ${jobId} completed.`);
  console.log("📦 Job Result:", returnvalue);

  if (returnvalue) {
    completedJobs.set(jobId, returnvalue);
    console.log(`✅ Job ${jobId} result stored in completedJobs.`);
  } else {
    console.warn(`⚠️ Job ${jobId} completed but returned no data.`);
  }
});

const deleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error(`❌ Error deleting file ${filePath}:`, err);
      else console.log(`🗑️ Deleted file: ${filePath}`);
    });
  }
};

const maxConcurrentTabs = 1;

const processWebsites = async (websiteUrls, jobId) => {
  const outputDir = path.join(__dirname, "../uploads/");
  let recordedVideos = [];

  for (let i = 0; i < websiteUrls.length; i += maxConcurrentTabs) {
    if (terminationRequested) {
      console.log(`🛑 Job ${jobId} termination requested. Stopping after current batch.`);
      break; // Stop queuing new batches
    }

    const chunk = websiteUrls.slice(i, i + maxConcurrentTabs);
    console.log(`🎥 Processing batch of ${chunk.length} websites...`);

    const chunkResults = await Promise.allSettled(
      chunk.map(async (webUrl) => {
        try {
          if (terminationRequested) return null; // Prevent new recordings
          return { webUrl, path: await recordWebsite(webUrl, outputDir) };
        } catch (err) {
          console.error(`❌ Failed to record ${webUrl}:`, err.message);
          return null;
        }
      })
    );

    // ✅ Ensure only successful recordings are added
    recordedVideos.push(...chunkResults.filter(r => r.status === "fulfilled" && r.value !== null).map(r => r.value));

    // 🛑 Stop after finishing the current batch if termination is requested
    if (terminationRequested) {
      console.log(`🛑 Job ${jobId} stopped after completing batch ${i / maxConcurrentTabs + 1}.`);
      break;
    }
  }

  console.log(`✅ Websites recorded successfully: ${recordedVideos.length}`);
  return recordedVideos;
};

const processJob = async (job) => {
  try {
    if (terminationRequested) {
      console.log(`🛑 Job ${job.id} skipped due to termination.`);
      return [];
    }

    console.log(`🚀 Processing job ${job.id}...`);
    const { excelPath, camVideoPath, userId } = job.data;

    if (!userId) throw new Error("❌ Missing userId in job data.");
    const user = await User.findById(userId);
    if (!user) throw new Error("❌ User not found for job.");
    const cameraSettings = user.cameraSettings;

    const websiteUrls = processExcel(excelPath);
    console.log("✅ Excel file processed successfully.", websiteUrls);
    if (!websiteUrls.length)
      throw new Error("❌ No valid URLs found in the Excel file.");

    // ✅ Use extracted parallel processing function
    const recordedVideos = await processWebsites(websiteUrls, job.id);
    if (!recordedVideos.length)
      throw new Error("❌ No recordings succeeded.");

    const mergedVideos = [];
    for (const { webUrl, path: webVideo } of recordedVideos) {
      const outputFilePath = `./uploads/merged_${Date.now()}.mp4`;

      try {
        console.log("🔄 Merging videos...");
        await mergeVideos(webVideo, camVideoPath, outputFilePath, cameraSettings);

        console.log("☁️ Uploading to S3...");
        const s3Url = await uploadToS3(outputFilePath, `merged_${Date.now()}.mp4`);
        mergedVideos.push(s3Url);
        console.log(`✅ Video uploaded to S3: ${s3Url}`);
      } catch (mergeError) {
        console.error(`❌ Merging or Uploading Failed for ${webUrl}:`, mergeError.message);
      } finally {
        deleteFile(webVideo);
        deleteFile(outputFilePath);
      }
    }

    deleteFile(excelPath);
    deleteFile(camVideoPath);

    // ✅ Ensure correct mapping before saving to MongoDB
    const videoRecords = mergedVideos.map((url, index) => ({
      websiteUrl: recordedVideos[index]?.webUrl || "Unknown",
      mergedUrl: url,
    }));

    if (videoRecords.length > 0) {
      await Video.create({ userId, videos: videoRecords });
      console.log("✅ Videos successfully saved to DB!");
    } else {
      console.warn("⚠️ No videos processed. Skipping DB save.");
    }

    console.log(`✅ Job ${job.id} completed.`);
    return mergedVideos;
  } catch (error) {
    console.error(`❌ Error in job ${job.id}:`, error.message);
    throw error;
  }
};



let videoWorker = new Worker(
  "videoProcessing",
  async (job) => {
    if (terminationRequested) {
      console.log(`🛑 Job ${job.id} skipped due to termination.`);
      return;
    }
    return await processJob(job);
  },
  {
    connection: redisConnection,
    concurrency: maxConcurrency,
    lockDuration: 60000,
  }
);

const terminateProcessing = async (req, res) => {
  try {
    console.log("🛑 Termination Requested!");
    terminationRequested = true;

    // Pause Queue
    await videoQueue.pause();
    console.log("🚫 Queue Paused!");

    // Close Worker
    if (videoWorker) {
      await videoWorker.close();
      console.log("💀 Worker Closed!");
    }

    // Wait before clearing queue
    console.log("⏳ Waiting before clearing queue...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Drain and clear queue
    await videoQueue.drain();
    console.log("🧹 Queue Drained (Removed Waiting Jobs)!");

    await videoQueue.obliterate({ force: true });
    console.log("🔥 All Jobs Cleared!");

    // Reset Redis
    await redisConnection.flushall();
    console.log("🧹 Redis fully reset!");

    // Clear Completed Jobs Map
    completedJobs.clear();
    console.log("🧹 Cleared completed jobs map!");

    terminationRequested = false;

     // 🔄 **Check & Restart Redis Connection**
     if (!redisConnection.status || redisConnection.status !== "ready") {
      console.log("🔄 Redis connection lost. Reconnecting...");
      redisConnection = new Redis({
        host: "localhost",
        port: 6379,
      });

      redisConnection.on("ready", () => {
        console.log("✅ Redis Reconnected!");
      });

      redisConnection.on("error", (err) => {
        console.error("❌ Redis Connection Error:", err);
      });

      // Wait for Redis to be ready
      await new Promise((resolve) => redisConnection.once("ready", resolve));
    } else {
      console.log("✅ Redis already connected.");
    }
    // 🔄 **Restarting Worker**
    console.log("🔄 Restarting Worker...");
    videoWorker = new Worker(
      "videoProcessing",
      async (job) => await processJob(job),
      {
        connection: redisConnection,
        concurrency: maxConcurrency,
        lockDuration: 60000,
      }
    );

    // Ensure worker is ready
    await videoWorker.waitUntilReady();
    console.log("✅ Worker Restarted Successfully!");

    // Resume Queue
    await videoQueue.resume();
    console.log("▶️ Queue Resumed!");

    if (res) {
      return res.json({ message: "Processing terminated and restarted successfully." });
    } else {
      console.log("✅ Termination & Restart completed.");
    }
  } catch (error) {
    console.error("❌ Error during termination:", error);

    if (res) {
      return res.status(500).json({ error: "Failed to terminate processing" });
    }
  }
};


redisConnection.on("connect", () => console.log("✅ Redis connected!"));
redisConnection.on("error", (err) =>
  console.error("❌ Redis connection error:", err)
);

module.exports = {
  videoQueue,
  videoWorker,
  terminateProcessing,
  completedJobs,
  queueEvents
};
