const Payment = require("../models/Payment");
const {
  createOrder,
  getCashfreePaymentStatus,
} = require("../utils/cashfreeHelper");
const User = require("../models/User");
require("dotenv").config();
const axios = require("axios");

// ✅ Initiate Payment

exports.initiatePayment = async (req, res) => {
  try {
    console.log("🔍 [DEBUG] Initiating Payment...");

    const { amount, orderId, planDetails, currency = "INR" } = req.body; // ✅ Allow dynamic currency

    if (!amount || !orderId || !planDetails) {
      console.error("❌ [ERROR] Missing required fields:", req.body);
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log("✅ [INFO] Received valid payment request:", { userId, amount, orderId, planDetails });

    const orderData = {
      order_id: orderId,
      order_amount: amount,
      order_currency: currency, // ✅ Allow payments in INR, USD, etc.
      order_note: `Subscription upgrade to ${planDetails}`,
      customer_details: {
        customer_id: `cust_${orderId}`,
        customer_email: user.email,
        customer_phone: user.phoneNumber,
        customer_name: user.username,
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL}/payment-status?order_id=${orderId}`,
        notify_url: `${process.env.BACKEND_URL}/api/payments/webhook`,
        payment_methods: "cc,dc,upi,nb,paylater", // ✅ Supports multiple payment types
      },
    };

    console.log("🔍 [DEBUG] Sending request to Cashfree API:", orderData);

    // ✅ Create Order on Cashfree
    const paymentResponse = await createOrder(orderData);

    if (!paymentResponse.payment_session_id) {
      throw new Error("Failed to create payment session with Cashfree.");
    }

    console.log("✅ [INFO] Received response from Cashfree API:", paymentResponse);

    // ✅ Update User Subscription Plan
    user.planDetails = planDetails;
    await user.save();

    // ✅ Save Payment in Database
    const newPayment = new Payment({
      userId,
      orderId,
      planDetails,
      amount,
      currency,
      referenceId: paymentResponse.cf_order_id || null, // ✅ Ensure referenceId exists
      status: paymentResponse.order_status || "PENDING", // ✅ Default status if missing
    });

    await newPayment.save();

    res.status(200).json({
      success: true,
      status: paymentResponse.order_status,
      payment_session_id: paymentResponse.payment_session_id,
      order_id: paymentResponse.order_id,
    });
  } catch (error) {
    console.error("❌ [ERROR] Error in initiatePayment:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// ✅ Get Payment Status
exports.getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("🔍 [DEBUG] Fetching Payment Status for Order:", orderId);

    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: "Order ID is required" });
    }

    // ✅ Fetch Payment Status from Cashfree API
    const paymentDetails = await getCashfreePaymentStatus(orderId);

    console.log("✅ [INFO] Cashfree API Payment Status:", paymentDetails);

    // ✅ Find Payment Record
    const payment = await Payment.findOne({ orderId });
    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment record not found" });

    // ✅ Update Payment Status
    payment.status = paymentDetails.order_status;
    await payment.save();

    // ✅ Store Payment in User's Payment History
    await User.findByIdAndUpdate(payment.userId, {
      $push: {
        paymentHistory: {
          orderId,
          amount: paymentDetails.order_amount,
          status: paymentDetails.order_status,
          date: new Date(),
        },
      },
    });

    res
      .status(200)
      .json({ success: true, orderId, status: paymentDetails.order_status });
  } catch (error) {
    console.error("❌ [ERROR] Error in getPaymentStatus:", error.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ✅ Webhook to Auto-Upgrade Plan

exports.paymentWebhook = async (req, res) => {
  try {
    console.log("🔔 [DEBUG] Webhook Data Received:", req.body);

    const { orderId, orderAmount, referenceId, txStatus } = req.body;

    if (!orderId || !orderAmount || !txStatus) {
      console.error("❌ [ERROR] Missing required fields in webhook data");
      return res
        .status(400)
        .json({ success: false, message: "Invalid webhook data" });
    }

    // ✅ Fetch Payment Record
    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      console.error("❌ [ERROR] Payment record not found:", orderId);
      return res
        .status(404)
        .json({ success: false, message: "Payment record not found" });
    }

    // ✅ Ignore Already Processed Payments
    if (payment.status === "PAID") {
      console.log("⚠️ [INFO] Duplicate Webhook - Payment Already Processed:", orderId);
      return res.status(200).json({ success: true, message: "Payment already processed" });
    }

    // ✅ Update Payment Status
    payment.status = txStatus === "SUCCESS" ? "PAID" : "FAILED";
    payment.referenceId = referenceId;
    await payment.save();

    if (txStatus !== "SUCCESS") {
      console.log(`❌ [INFO] Payment Failed for Order ID: ${orderId}`);
      return res.status(200).json({ success: true, message: "Payment failed, no upgrade applied" });
    }

    // ✅ Fetch User & Auto-Upgrade Plan
    const user = await User.findById(payment.userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // ✅ Auto-Upgrade Plan Logic
    const upgradePlan = (amount) => {
      if (amount >= 5000) return "Enterprise";
      if (amount >= 2500) return "Pro";
      if (amount >= 1000) return "Starter";
      return user.planDetails; // No downgrade
    };

    const newPlan = upgradePlan(orderAmount);
    if (newPlan !== user.planDetails) {
      user.planDetails = newPlan;
      user.videosCount = 0; // ✅ Reset video count on plan upgrade
    }

    // ✅ Store Payment in User's Payment History
    user.paymentHistory.push({
      orderId,
      amount: orderAmount,
      status: payment.status,
      date: new Date(),
    });

    await user.save();

    console.log(`✅ [INFO] User ${user.email} upgraded to: ${newPlan}`);

    res
      .status(200)
      .json({ success: true, message: "Webhook processed successfully" });

  } catch (error) {
    console.error("❌ [ERROR] Webhook Error:", error.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
