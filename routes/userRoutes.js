const express = require("express");
const {
  getCameraSettings,
  updateCameraSettings,
  upgradeUserPlan,
  getVideoPreference, // ✅ Added missing getVideoPreference route
  updateVideoPreference
} = require("../controllers/userController.js");

const { verifyToken } = require("../middleware/verifyToken.js"); // ✅ Ensure correct path

const router = express.Router();

// ✅ Protected Routes (Require Authentication)
router.get("/camera-settings", verifyToken, getCameraSettings);
router.put("/camera-settings", verifyToken, updateCameraSettings);

router.put("/upgrade-plan", verifyToken, upgradeUserPlan);

router.get("/video-preference", verifyToken, getVideoPreference); // ✅ Added route
router.put("/video-preference", verifyToken, updateVideoPreference);

module.exports = router;
