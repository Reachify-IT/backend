const express = require("express");
const { mergeVideos, getVideo } = require("../controllers/videoController");
const router = express.Router();

router.post("/merge", mergeVideos);
router.get("/video/:id", getVideo);

module.exports = router;
