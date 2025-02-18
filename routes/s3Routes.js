const express = require("express");
const router = express.Router();
const { getVideo, listVideos } = require("../controllers/s3Controller");


// GET route to retrieve a specific video by filename
router.get("/video/:fileName", getVideo);

// GET route to list all uploaded videos
router.get("/videos", listVideos);

module.exports = router;
