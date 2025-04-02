const { client } = require("../config/paypalConfig");
const Payment = require("../models/Payment");
const User = require("../models/User");
const { upgradePlan } = require("../services/subscriptionService");
const paypal = require("@paypal/checkout-server-sdk");

// Plans
const plans = {
  Starter: 0.01,
  Pro: 2500,
  Enterprise: 5000,
};

// ✅ Initiate PayPal Payment and Get Approval URLconst paypal = require('@paypal/checkout-server-sdk');
require('dotenv').config();

function getPayPalClient() {
  let environment =
    process.env.PAYPAL_MODE === 'sandbox'
      ? new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      )
      : new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      );

  return new paypal.core.PayPalHttpClient(environment);
}

exports.initiatePaypalPayment = async (req, res) => {
  try {
    const { planDetails } = req.body;
    const userId = req.user.id;

    console.log("🚀 ~ initiatePaypalPayment ~ planDetails", planDetails);

    if (!plans[planDetails]) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan selected" });
    }

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const orderId = `paypal_${Date.now()}`;

    // Initialize PayPal Client
    const client = getPayPalClient();

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: orderId,
          description: `Upgrade to ${planDetails}`,
          amount: {
            currency_code: "USD",
            value: plans[planDetails].toString(),
          },
        },
      ],
      application_context: {
        return_url: `${process.env.FRONTEND_URL}/payment-status?order_id=${orderId}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment-cancelled?order_id=${orderId}`,
      },
    });

    const order = await client.execute(request);

    const approvalUrl = order.result.links.find(
      (link) => link.rel === "approve"
    )?.href;

    if (!approvalUrl) {
      throw new Error("Approval URL not found");
    }

    // Save order to DB (initial stage)
    const payment = new Payment({
      orderId,
      userId,
      planDetails,
      amount: plans[planDetails],
      currency: "USD",
      paymentMethod: "paypal",
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
    });

    await payment.save();

    res.status(200).json({
      success: true,
      approvalUrl,
      orderId,
    });
  } catch (err) {
    console.error("❌ initiatePaypalPayment Error:", err.message);
    res.status(500).json({ success: false, message: "Payment initiation failed" });
  }
};

exports.capturePaypalPayment = async (req, res) => {
  try {
    const { paypalOrderId, orderId } = req.body;
    const client = getPayPalClient(); // Initialize PayPal client

    const captureRequest = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
    captureRequest.requestBody({});

    const capture = await client.execute(captureRequest);
    const status = capture.result.status;

    if (!capture.result.purchase_units[0]?.payments?.captures) {
      return res.status(400).json({ success: false, message: "No capture details found" });
    }

    const transactionId =
      capture.result.purchase_units[0].payments.captures[0].id;
    const amount =
      capture.result.purchase_units[0].payments.captures[0].amount.value;

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    payment.paymentStatus = status === "COMPLETED" ? "SUCCESS" : "FAILED";
    payment.orderStatus = status === "COMPLETED" ? "PAID" : "PENDING";
    payment.transactionId = transactionId;

    await payment.save();

    if (status === "COMPLETED") {
      const upgrade = await upgradePlan(payment.userId, payment.planDetails, {
        orderId,
        amount,
        status: "SUCCESS",
      });

      return res.status(200).json({
        success: true,
        message: "Payment captured and plan upgraded",
        payment,
        upgrade,
      });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Payment not completed", payment });
    }
  } catch (err) {
    console.error("❌ capturePaypalPayment Error:", err.message);
    res.status(500).json({ success: false, message: "Error capturing PayPal payment" });
  }
};


// ✅ Get Payment by Order ID
exports.getPaymentById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id; // Assuming user is authenticated

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    const payment = await Payment.findOne({ orderId, userId });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    res.status(200).json({ success: true, payment });
  } catch (error) {
    console.error("❌ getPaymentById Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.getPaypalClientId = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    res.status(200).json({ clientId: process.env.PAYPAL_CLIENT_ID });
  } catch (error) {
    console.error("❌ getPaypalClientId Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};