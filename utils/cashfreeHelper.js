const axios = require("axios");
const config = require("../config/cashfreeConfig");

const CASHFREE_BASE_URL = config.CASHFREE_ENV === "sandbox"
  ? "https://sandbox.cashfree.com/pg"
  : "https://api.cashfree.com/pg";

// ✅ Create Order on Cashfree
async function createOrder(orderData) {
  try {
    const url = `${CASHFREE_BASE_URL}/orders`;
    console.log("🔍 Sending API Request to:", url);

    const response = await axios.post(url, orderData, {
      headers: {
        Accept: "application/json",
        "x-api-version": process.env.CASHFREE_API_VERSION,
        "x-client-id": process.env.CASHFREE_APP_ID,
        "x-client-secret": process.env.CASHFREE_SECRET_KEY,
      },
    });

    console.log("✅ [INFO] Cashfree API Response:", response.data);

    if (!response.data.payment_session_id) {
      throw new Error("❌ Payment Session ID is missing in response");
    }

    return { ...response.data };
  } catch (error) {
    console.error("❌ Error in createOrder:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to create order");
  }
}

// ✅ Fetch Payment Status
async function getCashfreePaymentStatus(orderId) {
  try {
    const url = `${CASHFREE_BASE_URL}/orders/${orderId}`;
    console.log("🔍 Fetching Payment Status from:", url);

    const response = await axios.get(url, {
      headers: {
        "x-api-version": config.CASHFREE_API_VERSION,
        "x-client-id": config.CASHFREE_APP_ID,
        "x-client-secret": config.CASHFREE_SECRET_KEY,
      },
    });

    return response.data;
  } catch (error) {
    console.error("❌ Error fetching payment status:", error.response?.data || error.message);
    throw new Error("Failed to fetch payment status");
  }
}
async function getCashfreePaymentStatuswithTransition(orderId) {
  try {
    const url = `${CASHFREE_BASE_URL}/orders/${orderId}/payments`;
    console.log("🔍 Fetching Payment Status from:", url);

    const response = await axios.get(url, {
      headers: {
        "x-api-version": config.CASHFREE_API_VERSION,
        "x-client-id": config.CASHFREE_APP_ID,
        "x-client-secret": config.CASHFREE_SECRET_KEY,
      },
    });

    return response.data;
  } catch (error) {
    console.error("❌ Error fetching payment status:", error.response?.data || error.message);
    throw new Error("Failed to fetch payment status");
  }
}

module.exports = { createOrder, getCashfreePaymentStatus,getCashfreePaymentStatuswithTransition };
