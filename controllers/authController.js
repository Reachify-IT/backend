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
    if (existingUser)
      return res.status(400).json({ error: "Email or Username already exists" });

    // Check if phone number is already registered
    const existingPhone = await UserService.findByPhone(phoneNumber);
    if (existingPhone)
      return res.status(400).json({ error: "Phone number already exists" });

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 3); // Set expiry after 3 days

    await UserService.createUser({
      username,
      email,
      phoneNumber,
      password: hashedPassword,
      role,
      planDetails: "Trial", // Default to Trial
      trialEndDate,
    });

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

    // Check if the user is on a "Trial" plan and it has expired
    if (user.planDetails === "Trial" && user.trialEndDate && new Date() > user.trialEndDate) {
      return res.status(403).json({
        error: "Your free trial has expired. Please upgrade to continue.",
      });
    }

    // Generate Access Token
    const accessToken = generateToken(user._id);
    res.status(200).json({ accessToken, user: UserService.sanitizeUser(user) });

    setTimeout(() => {
      sendNotification(user._id, "✅ Login Successful! 🚀");
    }, 1000);
  } catch (err) {
    next(err);
  }
};


const userDetails = async (req, res, next) => {
  try {
    const user = await UserService.findById(req.user.id); // Find by ID instead of email
    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json({ user: UserService.sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
};


const updateDetails = async (req, res, next) => {
  let userId;
  try {
    const { username, email, phoneNumber } = req.body;
    const userId = req.user.id; // Get user ID from token

    // Check if email or phone number already exists
    const existingEmail = await UserService.findByEmail(email);
    if (existingEmail && existingEmail._id.toString() !== userId) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const existingPhone = await UserService.findByPhone(phoneNumber);
    if (existingPhone && existingPhone._id.toString() !== userId) {
      return res.status(400).json({ error: "Phone number already exists" });
    }

    // Update user details
    const updatedUser = await UserService.updateUser(userId, {
      username,
      email,
      phoneNumber,
    });

    sendNotification(userId, "✅ User Details Updated Successfully! 🚀");

    res
      .status(200)
      .json({
        message: "User details updated successfully",
        user: UserService.sanitizeUser(updatedUser),
      });
  } catch (err) {
    if (userId) {
      sendNotification(userId, "❌ User Details Update Failed! 🚀");
    }
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





module.exports = { signup, signin, userDetails, updateDetails, logout };
