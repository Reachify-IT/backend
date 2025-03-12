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
const { sendEmailIMAP, sendBulkEmails, sendEmail } = require("../controllers/emailController");
const googlemailSchema = require("../models/googlemailSchema");
const mailSchema = require("../models/mailSchema");
const imapschema = require("../models/imapschema");
const { sendNotification } = require("../services/notificationService");


const maxConcurrency = Math.max(1, os.cpus().length - 1);
let terminationRequested = false;


const redisConnection = new Redis(process.env.REDIS_URL, {
  tls: { rejectUnauthorized: false },
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  lazyConnect: true, // Connect only when needed
  retryStrategy: (times) => Math.min(times * 50, 2000),
  reconnectOnError: (err) => {
    console.error("❌ Redis Connection Error:", err.message);
    return true; // Auto-reconnect
  },
  maxmemory: "500mb", // Prevent excessive memory usage
  keepAlive: 5000, // Keep connection alive
});

const emailJobQueue = new Queue("emailJobs", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 jobs for debugging
    removeOnFail: 50, // Store only last 50 failed jobs
    attempts: 3,
  }
});

// Optimized Job Queue
const videoQueue = new Queue("videoProcessing", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 jobs for debugging
    removeOnFail: 50, // Store only last 50 failed jobs
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
  limiter: {
    max: 5, // Process max 5 jobs per second
    duration: 1000, // Limits Redis command hits
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

const maxConcurrentTabs = 5;

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

    const data = processExcel(excelPath);
    console.log("✅ Excel file processed successfully.", data);
    if (!data.length) throw new Error("❌ No valid data found in the Excel file.");

    // ✅ Process Websites in Parallel
    const recordedVideos = await processWebsites(data.map((row) => row.WebsiteUrl), job.id);
    if (!recordedVideos.length) throw new Error("❌ No recordings succeeded.");

    // ✅ Parallel Processing: Merging Videos & Uploading to S3
    const mergedVideos = await Promise.all(
      recordedVideos.map(async ({ webUrl, path: webVideo }, index) => {
        const outputFilePath = `./uploads/merged_${Date.now()}_${index}.mp4`;

        try {
          console.log(`🔄 Merging video for row ${index + 1}...`);
          await mergeVideos(webVideo, camVideoPath, outputFilePath, cameraSettings);

          console.log(`☁️ Uploading merged video to S3 for row ${index + 1}...`);
          const s3Url = await uploadToS3(outputFilePath, `merged_${Date.now()}_${index}.mp4`);

          console.log(`✅ Video uploaded to S3: ${s3Url}`);
          return { rowNumber: index + 1, s3Url, webUrl };
        } catch (error) {
          console.error(`❌ Error processing row ${index + 1}:`, error.message);
          return null;
        } finally {
          deleteFile(webVideo);
          deleteFile(outputFilePath);
        }
      })
    );

    // ✅ Filter out failed merges
    const successfulMerges = mergedVideos.filter((video) => video !== null);
    if (!successfulMerges.length) throw new Error("❌ No videos successfully processed.");

    // ✅ Fetch Email Configurations in Parallel
    const [googlemail, microsoft, imap] = await Promise.all([
      googlemailSchema.findOne({ userId }),
      mailSchema.findOne({ userId }),
      imapschema.findOne({ userId }),
    ]);

    // ✅ Queue Emails for Sending One by One
    for (const { rowNumber, s3Url } of successfulMerges) {
      const matchedRow = data[rowNumber - 1];

      if (!matchedRow || !matchedRow.Email) {
        console.warn(`⚠️ No email found for row ${rowNumber}. Skipping email.`);
        continue;
      }

      const { Email: recipientEmail, Name, WebsiteUrl, ClientCompany, ClientDesignation } = matchedRow;
      console.log(`📤 Sending email to: ${recipientEmail} (Row: ${rowNumber})`);

      try {
        if (googlemail) {
          await sendEmail({ email: recipientEmail, userId, s3Url, Name, WebsiteUrl, ClientCompany, ClientDesignation });
        } else if (microsoft) {
          await sendBulkEmails({ email: recipientEmail, userId, s3Url, Name, WebsiteUrl, ClientCompany, ClientDesignation });
        } else if (imap) {
          await sendEmailIMAP({ email: recipientEmail, userId, s3Url, Name, WebsiteUrl, ClientCompany, ClientDesignation });
        } else {
          console.warn(`⚠️ No email service found for user ${userId}. Skipping email.`);
        }
      } catch (error) {
        console.error(`❌ Error sending email to ${recipientEmail}:`, error.message);
      }
    }


    deleteFile(excelPath);
    deleteFile(camVideoPath);

    // ✅ Store Processed Videos in Database
    const videoRecords = successfulMerges.map(({ s3Url, webUrl }) => ({
      mergedUrl: s3Url,
      websiteUrl: webUrl,
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
    sendNotification("🛑 Termination Requested!");
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