const UserService = require("../services/UserService");
const {
  hashPassword,
  verifyPassword,
  generateToken,
} = require("../utils/authUtils");
const { validationResult } = require("express-validator");
const { sendNotification } = require("../services/notificationService");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const MailCount = require("../models/MailCount");
const Video = require("../models/Video");

require("dotenv").config();

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

    // // Check if the user is on a "Trial" plan and it has expired
    // if (user.planDetails === "Trial" && user.trialEndDate && new Date() > user.trialEndDate) {
    //   return res.status(403).json({
    //     error: "Your free trial has expired. Please upgrade to continue.",
    //   });
    // }

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

    const videosCount = await Video.aggregate([
      {
        $match: { userId: user._id } // Filter videos by user
      },
      {
        $unwind: "$videos" // Deconstruct the videos array
      },
      {
        $group: {
          _id: {
            year: { $year: "$videos.createdAt" },
            month: { $month: "$videos.createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1 } // Sort by latest month first
      }
    ]);

    const monthlyVideos = videosCount.map(({ _id, count }) => ({
      year: _id.year,
      month: _id.month,
      totalVideos: count
    }));


    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json({
      user: UserService.sanitizeUser(user),
      success: true,
      monthlyVideos
    });
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
      sendNotification(userId, "❌ User Details Update Failed!, Email already exists! 🚀");
      return res.status(400).json({ error: "Email already exists" });
    }

    const existingPhone = await UserService.findByPhone(phoneNumber);
    if (existingPhone && existingPhone._id.toString() !== userId) {
      sendNotification(userId, "❌ User Details Update Failed!, Phone number already exists! 🚀");
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



// Forgot Password Route
const forgetpassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create Reset Token (expires in 15 minutes)
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "15m" });


    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const mailHTML = `<!DOCTYPE html>
              <html>
              <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>Password Reset - Loomify</title>
              </head>
              <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
                  <div style="max-width: 600px; margin: 30px auto; background: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
                      
                      <h1 style="color: #333; font-size: 24px; margin: 0; padding-bottom: 10px; border-bottom: 2px solid #eeeeee;">Loomify</h1>

                      <p style="font-size: 16px; color: #555; margin: 20px 0;">Hi,</p>

                      <p style="font-size: 16px; color: #555; margin: 0;">We received a request to reset your password for your Loomify account. Click the button below to reset it:</p>

                      <p style="margin: 20px 0;">
                          <a href="${resetUrl}" 
                              style="display: inline-block; padding: 12px 24px; background: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">
                              Reset Password
                          </a>
                      </p>

                      <p style="font-size: 16px; color: #555; margin: 0;">If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>

                      <p style="font-size: 16px; color: #555; font-weight: bold; margin-top: 10px;">This link is valid for 15 minutes.</p>

                      <p style="font-size: 14px; color: #888; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
                          Need help? Contact us at <a href="mailto:support@loomify.com" style="color: #007bff; text-decoration: none;">support@loomify.com</a>
                      </p>

                      <p style="font-size: 14px; color: #888; margin-top: 5px;">&copy; ${new Date().getFullYear()} Loomify. All rights reserved.</p>

                  </div>
              </body>
              </html>

      `


    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Password Reset Request",
      html: mailHTML
    });

    res.status(200).json({
      success: true,
      message: "Password reset email sent"
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}

// Reset Password Route
const resetpassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("decoded", decoded.id);

    const user = await User.findById(decoded.id);


    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);


    await user.save();
    res.status(200).json({
      success: true,
      message: "Password reset successful"
    });
  } catch (error) {
    res.status(400).json({ message: "Invalid or expired token" });
  }
}

const getMailCount = async (req, res) => {
  try {
    const userId = req.user.id; // Ensure the user ID is coming from the decoded token

    const mailCount = await MailCount.findOne({ userId });

    if (!mailCount) {
      return res.status(404).json({ success: false, message: "Mail count not found" });
    }

    res.status(200).json({ success: true, data: mailCount });
  } catch (error) {
    console.error("Error fetching mail count:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}






module.exports = { signup, signin, userDetails, updateDetails, logout, forgetpassword, resetpassword, getMailCount };
