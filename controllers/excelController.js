const fs = require("fs");
const path = require("path");
const { videoQueue } = require("../workers/videoWorker");
const processExcel = require("../utils/processExcel");
const { terminateProcessing, mergedUrls } = require("../workers/videoWorker");
const { queueEvents } = require("../workers/videoWorker");
const Video = require("../models/Video");
const {
  canUploadVideos,
  incrementVideoCount,
} = require("../services/subscriptionService");
const { sendNotification } = require("../services/notificationService");
const moment = require("moment");
const imapschema = require("../models/imapschema");
const googlemailSchema = require("../models/googlemailSchema");
const mailSchema = require("../models/mailSchema");
const User = require("../models/User");

let uploadedFiles = {
  excelPath: null,
  camVideoPath: null,
};

const EMAIL_LIMITS = [
  { days: 3, limit: 30 },
  { days: 7, limit: 70 },
  { days: 14, limit: 200 },
  { days: 30, limit: 500 },
  { days: 60, limit: 1000 }, // Example: Increase limit after 60 days
  { days: 90, limit: 2000 }, // Example: Further increase at 90 days
];

const maxConcurrentTabs = 5;

// 🟢 Upload Excel File (Only `.xlsx`)
exports.uploadExcel = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No Excel file uploaded" });

    // ✅ Ensure User is Authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Unauthorized: User ID missing" });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    // ✅ Trial Limit Check (Prevents exceeding 25 videos)
    if (user.planDetails === "Trial" && user.videosCount >= 30) {
      return res
        .status(403)
        .json({ error: "Trial limit reached. Upgrade to continue." });
    }

    uploadedFiles.excelPath = req.file.path;
    console.log("📂 Excel file uploaded:", uploadedFiles.excelPath);

    res.status(200).json({
      message: "Excel file uploaded successfully",
      path: uploadedFiles.excelPath,
    });
  } catch (error) {
    console.error("❌ Error uploading Excel file:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 🟢 Upload Camera Video (Only `.mp4`)
exports.uploadCamVideo = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No camera video uploaded" });

    uploadedFiles.camVideoPath = req.file.path;
    console.log("📹 Camera video uploaded:", uploadedFiles.camVideoPath);

    res.status(200).json({
      message: "Camera video uploaded successfully",
      path: uploadedFiles.camVideoPath,
    });
  } catch (error) {
    console.error("❌ Error uploading camera video:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const waitForQueueReady = async () => {
  while (
    (await videoQueue.getJobCounts()).waiting > 0 ||
    (await videoQueue.getJobCounts()).delayed > 0
  ) {
    console.log("⏳ Waiting for queue to fully reset...");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.log("✅ Queue is ready for new jobs!");
};

exports.startProcessing = async (req, res) => {
  let userId; // Declare userId outside try block to be accessible in catch block

  try {
    console.log("⚠️ startProcessing() was called! Checking why...");

    if (!Boolean(req.body.manualStart)) {
      console.log("🚫 Rejecting automatic trigger!");
      return res
        .status(400)
        .json({ error: "Processing must be manually started." });
    }

    if (!uploadedFiles.excelPath || !uploadedFiles.camVideoPath) {
      return res
        .status(400)
        .json({ error: "Both Excel and Camera video must be uploaded first" });
    }

    console.log("📂 Processing Excel File:", uploadedFiles.excelPath);
    console.log("📹 Processing Camera Video:", uploadedFiles.camVideoPath);

    // ✅ Read the Excel file
    const websiteUrls = processExcel(uploadedFiles.excelPath);
    if (websiteUrls.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid URLs found in the Excel file" });
    }

    let videoCount = websiteUrls.length; // ✅ Extract number of videos to process

    userId = req.user?.id; // Assign userId from request
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User ID missing" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    console.log("🚀 User Plan Details:", user.planDetails);

    if (
      user.planDetails === "Trial" &&
      user.trialEndDate &&
      new Date() > user.trialEndDate
    ) {
      return res.status(403).json({
        error: "Your free trial has expired. Please upgrade to continue.",
      });
    }

    const microSoftMail = await mailSchema.findOne({ userId });
    const googleMail = await googlemailSchema.findOne({ userId });
    const imapMail = await imapschema.findOne({ userId });

    const mailEntry = microSoftMail || googleMail || imapMail;
    console.log("🚀 mailEntry", mailEntry);

    if (!mailEntry) {
      return res
        .status(401)
        .json({ error: "Unauthorized: No email account found for this user." });
    }

    const today = moment().startOf("day");

    if (!mailEntry.dailyEmailCount) {
      mailEntry.dailyEmailCount = { date: today.toDate(), count: 0 };
      await mailEntry.save();
    }

    const accountAgeInDays = moment().diff(
      moment(mailEntry.dailyEmailCount.date),
      "days"
    );
    const emailLimit =
      EMAIL_LIMITS.find((limit) => accountAgeInDays <= limit.days)?.limit ||
      500;

    if (moment(mailEntry.dailyEmailCount.date).isBefore(today)) {
      mailEntry.dailyEmailCount.date = today.toDate();
      mailEntry.dailyEmailCount.count = 0;
      await mailEntry.save();
    }

    if (mailEntry.dailyEmailCount.count >= emailLimit) {
      console.warn("⛔ Daily email limit reached.");
      sendNotification(
        userId,
        "⛔ Daily email limit reached. Try again tomorrow."
      );
      return res
        .status(403)
        .json({ message: "Daily email limit reached. Try again tomorrow." });
    }

    await waitForQueueReady();

    const uploadCheck = await canUploadVideos(userId, videoCount);

    if (!uploadCheck || typeof uploadCheck !== "object") {
      console.error(
        "❌ Error: canUploadVideos() returned an invalid response:",
        uploadCheck
      );
      return res
        .status(500)
        .json({ error: "Failed to check video upload eligibility." });
    }

    // ✅ Fix remaining being undefined
    let { allowed, message, remaining } = uploadCheck;
    remaining = Number.isFinite(remaining) ? remaining : 0; // Ensure `remaining` is a valid number

    if (!allowed) {
      console.warn(
        `⛔ Cannot process all videos. Available slots: ${remaining}`
      );

      if (remaining === 0) {
        return res.status(403).json({
          error:
            "No available slots. Upgrade your plan to continue processing.",
        });
      }

      videoCount = Math.min(videoCount, remaining);
      console.log(
        `✅ Final Adjusted videoCount: Processing only ${videoCount} videos.`
      );
    }

    if (user.planDetails === "Trial") {
      const maxTrialLimit = 30;
      const currentCount = user.videosCount || 0;

      if (currentCount >= maxTrialLimit) {
        return res.status(403).json({
          error: "Trial limit reached. Upgrade to continue processing.",
        });
      }

      videoCount = Math.min(videoCount, maxTrialLimit - currentCount);
      console.log(
        `🛑 Trial limit applied: Processing only ${videoCount} videos`
      );
    }

    // ✅ Fix: Ensure `videoCount` is a valid number
    if (!Number.isFinite(videoCount) || videoCount <= 0) {
      return res.status(403).json({
        error:
          "No valid videos to process. Upgrade your plan or check your inputs.",
      });
    }

    console.log(`Queuing ${videoCount} videos for processing...`);

    console.log("Queuing job for processing...");

    const job = await videoQueue.add(
      `process-videos-${userId}`, // Unique job name for each user
      {
        excelPath: uploadedFiles.excelPath,
        camVideoPath: uploadedFiles.camVideoPath,
        userId,
        videoCount,
      },
      {
        jobId: `video-process-${userId}-${Date.now()}`, // Ensures unique job for each user
        removeOnComplete: true, // Clean up completed jobs
        removeOnFail: false, // Keep failed jobs for debugging
      }
    );

    console.log(`✅ Job queued with ID: ${job.id}`);

    // ✅ Debugging: Check job status in the queue
    const jobCheck = await videoQueue.getJob(job.id);
    if (jobCheck) {
      console.log(`🔍 Job ${job.id} status:`, await jobCheck.getState());
    } else {
      console.error(`❌ Job ${job.id} not found in queue.`);
    }

    const checkJobCompletion = async (jobId) => {
      return new Promise((resolve, reject) => {
        console.log(`⏳ Waiting for job ${jobId} to complete...`);

        const handleJobCompletion = async ({
          jobId: completedJobId,
          returnvalue,
        }) => {
          if (completedJobId === jobId) {
            console.log(`✅ Job ${jobId} completed successfully.`);
            queueEvents.off("completed", handleJobCompletion); // ✅ Remove listener
            resolve(returnvalue);
          }
        };

        queueEvents.off("completed", handleJobCompletion); // Remove previous listener
        queueEvents.on("completed", handleJobCompletion);
        console.log(`🔍 Listener attached for Job ${job.id}`);
      });
    };

    const mergedUrls = await checkJobCompletion(job.id);
    console.log("Merged URLs in completed job:", mergedUrls);

    if (mergedUrls?.length > 0) {
      await incrementVideoCount(userId, mergedUrls.length);
      uploadedFiles.excelPath = null;
      uploadedFiles.camVideoPath = null;

      sendNotification(
        userId,
        `✅ ${mergedUrls.length} videos processed successfully. Remaining slots: ${remaining}`
      );
      return res.status(200).json({
        success: true,
        mergedUrls,
        message: `Videos processed successfully. Remaining slots: ${remaining}`,
      });
    } else {
      sendNotification(userId, "❌ Processing failed, no videos merged.");
      return res
        .status(500)
        .json({ error: "Processing failed, no videos merged." });
    }
  } catch (error) {
    if (userId) sendNotification(userId, "❌ Error queuing process.");
    console.error("❌ Error queuing process:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.terminateProcessing = async (req, res) => {
  try {
    await terminateProcessing();
    res.json({ message: "Processing terminated successfully." });
  } catch (error) {
    console.error("❌ Error terminating worker:", error);
    res.status(500).json({ error: "Failed to terminate processing" });
  }
};

exports.getAllVideos = async (req, res) => {
  try {
    // ✅ Validate user authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Unauthorized: User ID missing" });
    }

    const userId = req.user.id;

    // ✅ Fetch all videos for the authenticated user
    const videos = await Video.find({ userId }).sort({ createdAt: -1 }).lean(); // Optimizes query performance

    res.status(200).json({
      message:
        videos.length > 0 ? "Videos fetched successfully" : "No videos found.",
      videos,
    });
  } catch (error) {
    console.error("❌ Error fetching videos:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
