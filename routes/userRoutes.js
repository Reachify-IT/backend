const express = require("express");
const {
  getCameraSettings,
  updateCameraSettings,
  upgradeUserPlan,
} = require("../controllers/userController.js");

const { verifyToken } = require("../middleware/verifyToken.js"); // ✅ Ensure correct path

const router = express.Router();

// Protected routes
router.get("/camera-settings", verifyToken, getCameraSettings);
router.put("/camera-settings", verifyToken, updateCameraSettings);
router.put("/upgrade-plan", verifyToken, upgradeUserPlan);

module.exports = router;
