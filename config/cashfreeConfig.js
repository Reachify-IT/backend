require("dotenv").config();

const CASHFREE_BASE_URLS = {
  sandbox: "https://sandbox.cashfree.com/pg", // ✅ Correct URL
  prod: "https://api.cashfree.com/pg",
};

module.exports = {
  CASHFREE_ENV: process.env.CASHFREE_ENV || "prod",
  CASHFREE_APP_ID: process.env.CASHFREE_APP_ID,
  CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY,
  CASHFREE_API_VERSION: process.env.CASHFREE_API_VERSION || "2023-08-01",
  CASHFREE_SUCCESS_URL: process.env.CASHFREE_SUCCESS_URL,
  CASHFREE_CANCEL_URL: process.env.CASHFREE_CANCEL_URL,
  CASHFREE_BASE_URL: CASHFREE_BASE_URLS[process.env.CASHFREE_ENV] || CASHFREE_BASE_URLS["sandbox"],
};
