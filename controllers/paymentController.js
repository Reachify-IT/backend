const Payment = require("../models/Payment");
const {
  createOrder,
  getCashfreePaymentStatus,
} = require("../utils/cashfreeHelper");
const User = require("../models/User");
require("dotenv").config();
const axios = require("axios");


const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 1,
    looms: 2000,
  },
  {
    id: "pro",
    name: "Pro",
    price: 2500,
    looms: 5000,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 5000,
    looms: 10000,
  },
];

// ✅ Initiate Payment
exports.initiatePayment = async (req, res) => {
  try {
    console.log("🔍 [DEBUG] Initiating Payment...");

    const { orderId, planDetails } = req.body;

    // Find the plan that matches the name from req.body
    const selectedPlan = plans.find(plan => plan.name === planDetails);

    if (!selectedPlan) {
      return res.status(400).json({ error: "Invalid plan name" }); // Return error response
    }

    if (selectedPlan) {
      console.log(`Price of ${planDetails}:`, selectedPlan.price);
    } else {
      console.log("Plan not found!");
    }

    if (!selectedPlan || !orderId || !planDetails) {
      console.error("❌ [ERROR] Missing required fields:", req.body);
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      console.error("❌ [ERROR] User not found:", userId);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log("✅ [INFO] Valid payment request:", { userId, orderId, planDetails });

    const orderData = {
      order_id: orderId,
      order_amount: selectedPlan.price,
      order_currency: currency,
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
        payment_methods: "cc,dc,upi,nb,paylater",
      },
    };

    console.log("🔍 [DEBUG] Sending request to Cashfree API:", orderData);

    // ✅ Make API request to Cashfree
    const paymentResponse = await createOrder(orderData);

    if (!paymentResponse || !paymentResponse.payment_session_id) {
      console.error("❌ [ERROR] Failed to get payment_session_id from Cashfree:", paymentResponse);
      return res.status(500).json({ success: false, message: "Failed to create payment session with Cashfree." });
    }

    console.log("✅ [INFO] Cashfree Response:", paymentResponse);

    // ✅ Update User Subscription Plan
    user.planDetails = planDetails;
    await user.save();

    // ✅ Save Payment in Database
    const newPayment = new Payment({
      userId,
      orderId,
      planDetails,
      amount: paymentResponse.order_amount,
      currency,
      referenceId: paymentResponse.cf_order_id || null,
      orderStatus: paymentResponse.order_status || "PENDING",
    });

    await newPayment.save();

    return res.status(200).json({
      success: true,
      status: paymentResponse.order_status,
      payment_session_id: paymentResponse.payment_session_id,
      order_id: paymentResponse.order_id,
    });
  } catch (error) {
    console.error("❌ [ERROR] Error in initiatePayment:", error);
    return res.status(500).json({
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
    const transitionDetails = await getCashfreePaymentStatuswithTransition(orderId);

    console.log("✅ [INFO] Cashfree API Payment Status:", paymentDetails); lo

    // ✅ Find Payment Record
    const payment = await Payment.findOne({ orderId });
    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment record not found" });

    // ✅ Update Payment Status
    payment.orderStatus = paymentDetails.order_status;
    payment.paymentStatus = transitionDetails.payment_status;
    payment.transactionId = transitionDetails.cf_payment_id;

    await payment.save();

    // ✅ Store Payment in User's Payment History
    if (transitionDetails.payment_status === "SUCCESS") {
      await User.findByIdAndUpdate(payment.userId, {
        $push: {
          paymentHistory: {
            orderId,
            amount: paymentDetails.order_amount,
            status: transitionDetails.payment_status,
            date: new Date(),
          },
        },
      });
    }

    res
      .status(200)
      .json({ success: true, orderId, status: transitionDetails.payment_status });
    sentNotification(payment.userId, `Your Payment Status is: ${transitionDetails.payment_status}`);
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
