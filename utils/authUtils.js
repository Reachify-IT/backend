const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// 🔹 Hash Password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// 🔹 Verify Password
const verifyPassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

// 🔹 Generate Access Token (Short-lived)
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m", 
  });
};

// 🔹 Generate Refresh Token (Long-lived)
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d", })
};

module.exports = { hashPassword, verifyPassword, generateToken, generateRefreshToken };
