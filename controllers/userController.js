const User = require("../models/User.js");
const { sendNotification } = require("../services/notificationService.js");
const { upgradePlan } = require("../services/subscriptionService.js");


exports.upgradeUserPlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const { newPlan } = req.body; // Expecting "Gold" or "Diamond"

    const { success, message } = await upgradePlan(userId, newPlan);
    if (!success) return res.status(400).json({ error: message });

    res.status(200).json({ success: true, message });
  } catch (error) {
    console.error("❌ Plan Upgrade Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get Camera Settings
exports.getCameraSettings = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming user ID is extracted from auth middleware
    const user = await User.findById(userId, "cameraSettings");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ cameraSettings: user.cameraSettings });
  } catch (error) {
    console.error("Error fetching camera settings:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update Camera Settings
exports.updateCameraSettings = async (req, res) => {
  let userId;
  try {
    const userId = req.user.id; // Assuming user ID is extracted from auth middleware
    const { position, size } = req.body;

    // Validate input
    const validPositions = ["top-left", "top-right", "bottom-left", "bottom-right"];
    const validSizes = ["small", "medium", "large", "extra-large"];

    if (!validPositions.includes(position) || !validSizes.includes(size)) {
      return res.status(400).json({ message: "Invalid position or size" });
    }

    // Update camera settings
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { "cameraSettings.position": position, "cameraSettings.size": size },
      { new: true, select: "cameraSettings" }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    sendNotification(userId, "✅ Camera settings updated successfully!");

    res.status(200).json({ message: "Camera settings updated", cameraSettings: updatedUser.cameraSettings });
  } catch (error) {
    console.error("Error updating camera settings:", error);
    sendNotification(userId, "✅ Camera settings update failed!");
    res.status(500).json({ message: "Server error" });
  }
};
