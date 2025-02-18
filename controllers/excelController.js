const fs = require("fs");
const path = require("path");
const { videoQueue } = require("../config/redis");
const processExcel = require("../utils/processExcel");
const mergeVideos = require("../utils/mergeVideos"); // Import updated merge function
const recordWebsite = require("../utils/recordWebsite");
const uploadToS3 = require("../utils/uploadToS3"); // ✅ Import uploadToS3
const Video = require("../models/Video"); // ✅ Import Video model

let uploadedFiles = {
  excelPath: null,
  camVideoPath: null,
};

// 🟢 Upload Excel File (Only `.xlsx`)
exports.uploadExcel = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No Excel file uploaded" });

    uploadedFiles.excelPath = req.file.path;
    console.log("📂 Excel file uploaded:", uploadedFiles.excelPath);

    res.status(200).json({ message: "Excel file uploaded successfully", path: uploadedFiles.excelPath });
  } catch (error) {
    console.error("❌ Error uploading Excel file:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 🟢 Upload Camera Video (Only `.mp4`)
exports.uploadCamVideo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No camera video uploaded" });

    uploadedFiles.camVideoPath = req.file.path;
    console.log("📹 Camera video uploaded:", uploadedFiles.camVideoPath);

    res.status(200).json({ message: "Camera video uploaded successfully", path: uploadedFiles.camVideoPath });
  } catch (error) {
    console.error("❌ Error uploading camera video:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✅ Start Processing (After Both Files Are Uploaded)
exports.startProcessing = async (req, res) => {
  try {
    if (!uploadedFiles.excelPath || !uploadedFiles.camVideoPath) {
      return res.status(400).json({ error: "Both Excel and Camera video must be uploaded first" });
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
      return res.status(400).json({ error: "No valid URLs found in the Excel file" });
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

    res.status(202).json({
      message: "Processing started. Videos will be processed asynchronously.",
      jobId: job.id,
    });
  } catch (error) {
    console.error("❌ Error queuing process:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

