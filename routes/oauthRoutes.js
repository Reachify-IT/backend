const express = require("express");
const { googleAuthRedirect, googleCallback } = require("../controllers/oauthController");
const {verifyToken} = require("../middleware/verifyToken");

const router = express.Router();

router.get("/google", verifyToken, googleAuthRedirect); // ✅ Ensures only authenticated users can access OAuth
router.get("/google/callback", googleCallback); // ✅ Handles OAuth callback

module.exports = router;
