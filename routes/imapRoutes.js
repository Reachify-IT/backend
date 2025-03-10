const express = require("express");
const router = express.Router();
const { configureIMAP, verificationIMAP } = require("../controllers/imapController");
const { verifyToken } = require("../middleware/verifyToken");

router.post("/imap-config",verifyToken, configureIMAP);
router.post("/imap-verification",verifyToken, verificationIMAP);

module.exports = router;
