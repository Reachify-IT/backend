
const { getS3ObjectUrl, listS3Videos } = require("../services/s3Service");


exports.getVideo = async (req, res) => {
  const { fileName } = req.params;

  try {
    const videoUrl = await getS3ObjectUrl(fileName);
    res.status(200).json({ videoUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve video.", details: error.message });
  }
};

exports.listVideos = async (req, res) => {
  try {
    const videos = await listS3Videos();
    res.status(200).json({ videos });
  } catch (error) {
    res.status(500).json({ error: "Failed to list videos.", details: error.message });
  }
};
