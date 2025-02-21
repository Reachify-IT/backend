const NodeCache = require("node-cache");

// Initialize cache with 7-day expiration (time in seconds)
const cache = new NodeCache({ stdTTL: 7 * 24 * 60 * 60, checkperiod: 60 });

module.exports = cache;
