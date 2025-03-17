const express = require("express");
const { microsoftAuthRedirect, microsoftAuthCallback, mailInfo, getmailInfo, updateMailInfo } = require("../controllers/Oauth");

const { googleAuthRedirect, googleCallback } = require("../controllers/Oauth");
const {verifyToken} = require("../middleware/verifyToken");


const router = express.Router();

router.get("/microsoft/redirect",verifyToken, microsoftAuthRedirect); // Step 1: Redirect to Microsoft
router.get("/microsoft/callback", microsoftAuthCallback); // Step 2: Handle callback



router.get("/google", verifyToken, googleAuthRedirect); // ✅ Ensures only authenticated users can access OAuth
router.get("/google/callback", googleCallback); // ✅ Handles OAuth callback

router.post("/mailMyInfo",verifyToken ,mailInfo);
router.get("/getMyMailInfo",verifyToken ,getmailInfo);
router.post("/updateMailInfo",verifyToken ,updateMailInfo);


module.exports = router;
