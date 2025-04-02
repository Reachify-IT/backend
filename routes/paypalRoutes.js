const express = require("express");
const router = express.Router();
const paypalController = require("../controllers/paymentControllerPayPal");
const {verifyToken} = require("../middleware/verifyToken"); // Assuming JWT auth middleware

router.post("/initiate", verifyToken, paypalController.initiatePaypalPayment);
router.post("/capture", paypalController.capturePaypalPayment);
router.get("/config", verifyToken, paypalController.getPaypalClientId);
router.get("/:orderId", verifyToken, paypalController.getPaymentById);

module.exports = router;
