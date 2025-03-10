const express = require("express");
const { sendBulkEmails, getEmailInfoGoogle, sendEmailIMAP, getEmailInfoIMAP } = require("../controllers/emailController");
const { sendEmail, getEmailInfo } = require("../controllers/emailController");
const  {verifyToken}  = require("../middleware/verifyToken");

const router = express.Router();

// for outlook
router.post("/send-emails", verifyToken ,sendBulkEmails);

// for google
// ✅ Secure API: Only authenticated users can send bulk emails
router.post("/send", verifyToken, sendEmail);


router.get("/mailInfo",verifyToken, getEmailInfo);
router.get("/googleMailInfo",verifyToken, getEmailInfoGoogle);
router.get("/getEmailInfoIMAP",verifyToken, getEmailInfoIMAP);

router.post("/sendMail-IMAP",verifyToken, sendEmailIMAP);



module.exports = router;




