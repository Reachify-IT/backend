const axios = require("axios");

const webhookMiddleware = (webhookUrl) => {
  return async (req, res, next) => {
    try {
      if (req.body) {
        await axios.post(webhookUrl, req.body);
      }
    } catch (error) {
      console.error("Failed to call webhook:", error);
    }
    next();
  };
};

module.exports = webhookMiddleware;
