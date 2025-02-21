const fs = require("fs");
const path = require("path");
const { videoQueue } = require("../config/redis");
const processExcel = require("../utils/processExcel");
const { terminateProcessing, mergedUrls } = require("../workers/videoWorker");
const { completedJobs } = require("../workers/videoWorker");
const Video = require("../models/Video");

let uploadedFiles = {
  excelPath: null,
  camVideoPath: null,
};

// 🟢 Upload Excel File (Only `.xlsx`)
exports.uploadExcel = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No Excel file uploaded" });

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

// ✅ Start Processing (After Both Files Are Uploaded)
exports.startProcessing = async (req, res) => {
  try {
    if (!uploadedFiles.excelPath || !uploadedFiles.camVideoPath) {
      return res
        .status(400)
        .json({ error: "Both Excel and Camera video must be uploaded first" });
    }

    console.log("📂 Processing Excel File:", uploadedFiles.excelPath);
    console.log("📹 Processing Camera Video:", uploadedFiles.camVideoPath);

    // ✅ Extract `userId` from `req.user`
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User ID missing" });
    }

    const websiteUrls = processExcel(uploadedFiles.excelPath);
    if (websiteUrls.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid URLs found in the Excel file" });
    }

    console.log("Queuing job for processing...");

    // ✅ Add Job to Queue
    const job = await videoQueue.add("process-videos", {
      excelPath: uploadedFiles.excelPath,
      camVideoPath: uploadedFiles.camVideoPath,
      userId, // Include userId in job data
    });

    console.log(`✅ Job queued with ID: ${job.id}`);

    // ✅ Reset uploaded file paths after queuing
    uploadedFiles.excelPath = null;
    uploadedFiles.camVideoPath = null;

    // Poll for job completion
    const checkJobCompletion = async () => {
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (completedJobs.has(job.id)) {
            clearInterval(interval);
            resolve(completedJobs.get(job.id));
            completedJobs.delete(job.id); // Cleanup
          }
        }, 2000);
      });
    };

    const mergedUrls = await checkJobCompletion();

    if (mergedUrls?.length > 0) {
      return res.status(200).json({ success: true, mergedUrls });
    } else {
      return res
        .status(500)
        .json({ error: "Processing failed, no videos merged." });
    }
  } catch (error) {
    console.error("❌ Error queuing process:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
    const videos = await Video.find({ userId })
      .sort({ createdAt: -1 })
      .lean(); // Optimizes query performance

    res.status(200).json({
      message: videos.length > 0 ? "Videos fetched successfully" : "No videos found.",
      videos,
    });
  } catch (error) {
    console.error("❌ Error fetching videos:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
