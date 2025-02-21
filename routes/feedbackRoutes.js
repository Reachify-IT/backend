const express = require("express");
const { submitFeedback } = require("../controllers/feedbackController");
const { verifyToken } = require("../middleware/verifyToken");

const router = express.Router();

// 🔹 Submit Feedback (Authenticated Users Only)
router.post("/submit", verifyToken, submitFeedback);


module.exports = router;
