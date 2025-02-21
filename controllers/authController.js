const jwt = require("jsonwebtoken");
const UserService = require("../services/UserService");
const {
  hashPassword,
  verifyPassword,
  generateToken,
} = require("../utils/authUtils");
const { validationResult } = require("express-validator");
const { sendNotification } = require("../services/notificationService");

// 🔹 Handle Validation Errors
const validateRequest = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });
};

const signup = async (req, res, next) => {
  try {
    validateRequest(req, res);
    const { username, email, phoneNumber, password, role = "user" } = req.body;

    // Check if user already exists
    const existingUser = await UserService.findByEmailOrUsername(email, username);
    if (existingUser) return res.status(400).json({ error: "Email or Username already exists" });

    // Check if phone number is already registered
    const existingPhone = await UserService.findByPhone(phoneNumber);
    if (existingPhone) return res.status(400).json({ error: "Phone number already exists" });

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    await UserService.createUser({ username, email, phoneNumber, password: hashedPassword, role });

    // ✅ Only return a success message
    res.status(201).json({ message: "User created successfully", success: true });
  } catch (err) {
    next(err);
  }
};


// 🔹 Signin Controller
const signin = async (req, res, next) => {
  try {
    validateRequest(req, res);
    const { email, password } = req.body;

    // Find user and verify password
    const user = await UserService.findByEmail(email);
    if (!user || !(await verifyPassword(password, user.password))) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Generate Access Token
    const accessToken = generateToken(user._id);
    sendNotification("Login Successfully! 🚀");
    res.status(200).json({ accessToken, user: UserService.sanitizeUser(user) });

  } catch (err) {
    next(err);
  }
};

// 🔹 Secure Logout
const logout = async (req, res) => {
  try {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: "Logout failed" });
  }
};

module.exports = { signup, signin, logout };
