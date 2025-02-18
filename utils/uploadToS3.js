const fs = require("fs");
const path = require("path");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../config/s3");

/**
 * Uploads a file to AWS S3
 * @param {string} filePath - The local file path
 * @param {string} fileName - The desired file name in S3
 * @returns {Promise<string>} - The uploaded file URL
 */
const uploadToS3 = async (filePath, fileName) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found: " + filePath);
    }

    const fileContent = fs.readFileSync(filePath);
    const fileExtension = path.extname(fileName).toLowerCase();
    
    const mimeTypes = {
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".avi": "video/x-msvideo",
    };

    const contentType = mimeTypes[fileExtension] || "application/octet-stream";

    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `merged_videos/${fileName}`,
      Body: fileContent,
      ContentType: contentType,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/merged_videos/${fileName}`;
    console.log("✅ File uploaded successfully:", fileUrl);
    
    return fileUrl;
  } catch (error) {
    console.error("❌ S3 Upload Error:", error);
    throw new Error("Failed to upload file to S3");
  }
};

module.exports = uploadToS3;
