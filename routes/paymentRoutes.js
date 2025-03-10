const express = require("express");
const router = express.Router();
const {
  initiatePayment,
  // paymentWebhook,
  getPaymentStatus,
} = require("../controllers/paymentController");
 const  {verifyToken}  = require("../middleware/verifyToken");

// ✅ Initiate a payment
router.post("/initiate", verifyToken, initiatePayment);

// // ✅ Handle webhook for automatic status updates
// router.post("/webhook", paymentWebhook);

// ✅ Fetch payment status
router.get("/status/:orderId",verifyToken, getPaymentStatus);

module.exports = router;
