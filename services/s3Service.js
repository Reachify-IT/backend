const { S3Client,  ListObjectsV2Command } = require("@aws-sdk/client-s3");
require("dotenv").config();

const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_BUCKET_NAME;

async function getS3ObjectUrl(fileName) {
  if (!bucketName) throw new Error("AWS_BUCKET_NAME is not set.");

  return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/processed_videos/${fileName}`;
}

async function listS3Videos() {
  if (!bucketName) throw new Error("AWS_BUCKET_NAME is not set.");

  const command = new ListObjectsV2Command({ Bucket: bucketName, Prefix: "processed_videos/" });

  try {
    const { Contents } = await s3.send(command);

    if (!Contents || Contents.length === 0) return [];

    return Contents.map(item => ({
      fileName: item.Key.replace("processed_videos/", ""),
      url: `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`,
    }));
  } catch (error) {
    throw new Error(`Failed to list videos: ${error.message}`);
  }
}

module.exports = { getS3ObjectUrl, listS3Videos };
