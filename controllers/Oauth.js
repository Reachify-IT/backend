const axios = require("axios");
const qs = require("qs"); // Install with npm install qs
const jwt = require("jsonwebtoken");
require("dotenv").config();
const Mail = require("../models/googlemailSchema");
const User = require("../models/User");
const mailSchema = require("../models/mailSchema");

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL
const REDIRECT_URI = "http://localhost:8000/api/oauth/microsoft/callback";

const { google } = require("googleapis");

const oauth2Client = require("../config/googleAuth");
const MailInfoSchema = require("../models/MailInfoSchema");
const { sendNotification } = require("../services/notificationService");

// 1️⃣ Redirect User to Microsoft Login
exports.microsoftAuthRedirect = (req, res) => {
  const userId = req.user.id;

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=openid profile email offline_access https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read&state=${encodeURIComponent(
    userId
  )}&prompt=consent`;

  res.json({ authUrl }); // Return as a JSON object
};

// 2️⃣ Handle Microsoft Callback (Exchange Code for Token)
exports.microsoftAuthCallback = async (req, res) => {
  const { code, state } = req.query;

  console.log("📌 Authorization Code:", code);
  console.log("📌 State (User ID):", state);

  if (!code) {
    return res.status(400).json({ error: "❌ Authorization code missing" });
  }

  if (!state) {
    return res.status(400).json({ error: "❌ State (User ID) missing" });
  }

  try {
    const tokenData = qs.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      scope:
        "openid profile email offline_access https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read",
    });

    const tokenResponse = await axios.post(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      tokenData,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, id_token } = tokenResponse.data;
    console.log("✅ Access Token Received");

    // Decode user info from id_token
    const decodedIdToken = jwt.decode(id_token);
    console.log("📌 Decoded ID Token:", decodedIdToken);

    if (!decodedIdToken?.email) {
      return res
        .status(400)
        .json({ error: "❌ User email not found in token" });
    }

    // Verify user existence
    const user = await User.findById(state);
    if (!user) {
      return res.status(404).json({ error: "❌ User not found" });
    }

    // Check if email already exists
    const existingMail = await mailSchema.findOne({
      email: decodedIdToken.email,
    });
    if (existingMail) {
      return res.status(400).json({ error: "❌ Email already exists" });
    }

    // Save user authentication details
    const newMail = new mailSchema({
      userId: user._id,
      email: decodedIdToken.email,
      accessToken: access_token,
      refreshToken: refresh_token,
    });

    await newMail.save();
    console.log("✅ Email & Token Data Saved");

    // Redirect user to frontend with the token
    res.redirect(
      `${FRONTEND_URL}/home`
    );
  } catch (error) {
    console.error("❌ OAuth Error:", error.response?.data || error.message);
    res.status(500).json({ error: "OAuth authentication failed" });
  }
};

// for google
exports.googleAuthRedirect = (req, res) => {
  const userId = req.user.id; // ✅ Now userId is always available

  console.log("🔹 Redirecting user to Google OAuth for user:", userId);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.send", "email", "profile"],
    state: encodeURIComponent(userId), // ✅ Attach userId as state
  });

  res.json({ authUrl }); // ✅ Send auth URL to frontend
};

exports.googleCallback = async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    console.error("❌ Missing authorization code or state.");
    return res.status(400).json({ error: "Invalid OAuth response" });
  }

  const userId = decodeURIComponent(state); // ✅ Extract userId from state
  console.log("🔹 OAuth callback for user:", userId);

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    console.log("✅ Tokens received:", tokens);

    // Fetch user email
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    const email = data.email;

    if (!email) {
      console.error("❌ Email not found in Google response.");
      return res.status(500).json({ error: "Failed to retrieve email" });
    }

    console.log("📩 Retrieved email:", email);

    // ✅ Find the existing user by userId
    let user = await User.findById(userId);
    if (!user) {
      console.error("❌ User not found for ID:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    console.log("🔄 Updating OAuth tokens for user:", userId);

    // ✅ Store OAuth tokens in the correct schema
    let mailUser = await Mail.findOne({ userId });

    if (mailUser) {
      console.log("🔄 Updating existing refresh token...");
      if (tokens.refresh_token) {
        mailUser.googleRefreshToken = tokens.refresh_token;
      }
    } else {
      console.log("🆕 Creating new Mail entry...");
      mailUser = new Mail({
        userId, // ✅ Link to existing user
        email,
        googleRefreshToken: tokens.refresh_token || "", // Avoid storing undefined values
      });
    }

    await mailUser.save();
    console.log("✅ OAuth tokens saved successfully!");

    // Redirect frontend with success response
    const redirectUrl = `${FRONTEND_URL}/home`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("❌ OAuth Callback Error:", error);
    res.status(500).json({ error: "Authentication failed", details: error.message });
  }
};


exports.mailInfo = async (req, res) => {
  // Save form data
  const userId = req.user.id;
  try {
    const { my_company, my_designation, my_name, my_mail, my_work, my_cta_link } = req.body;

    if (!userId || !my_company || !my_designation || !my_name || !my_mail || !my_work || !my_cta_link) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const existingMailInfo = await MailInfoSchema.findOne({ userId });
    if (existingMailInfo) {
      return res.status(400).json({ error: "Form data already exists for this user" });
    }


    const formData = new MailInfoSchema({
      userId,
      my_company,
      my_designation,
      my_name,
      my_mail,
      my_work,
      my_cta_link,
    });

    await formData.save();

    res.status(200).json({
      success: true,
      message: "Form data saved successfully"
    });
    sendNotification(userId, "✅ Mail info data saved successfully!");
  } catch (error) {
    console.error("Error saving form data:", error);
    res.status(500).json({ error: "Internal Server Error" });
    sendNotification(userId, "❌ Error saving mail info data!");
  };


};


exports.getmailInfo = async (req, res) => {
  const userId = req.user.id; // Assuming this is coming as a string
  try {

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }



    const mailInfo = await MailInfoSchema.findOne({ userId }); // Use .lean() for plain JSON


    if (!mailInfo) {
      return res.status(200).json({
        status: "success",
        email: null,
        message: "No email found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: mailInfo, // Ensure it's properly sent
      message: "Data fetched successfully",
    });
  } catch (error) {
    console.error("❌ Get Email Info Error:", error.message);
    return res.status(500).json({ status: "error", message: "Failed to get email info" });
  }
};

exports.updateMailInfo = async (req, res) => {
  const userId = req.user.id;
  try {
    const { my_company, my_designation, my_name, my_mail, my_work, my_cta_link } = req.body;

    // Validate required fields
    if (!userId || !my_company || !my_designation || !my_name || !my_mail || !my_work || !my_cta_link) {
      return res.status(400).json({ error: "All fields are required" });
    }



    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find and update the existing mail info
    const updatedMailInfo = await MailInfoSchema.findOneAndUpdate(
      { userId },
      { my_company, my_designation, my_name, my_mail, my_work, my_cta_link },
      { new: true, runValidators: true }
    );

    if (!updatedMailInfo) {
      return res.status(404).json({ error: "Form data not found for this user" });
    }

    res.status(200).json({ success: true, message: "Form data updated successfully", data: updatedMailInfo });
    sendNotification(userId, "✅ Mail info data updated successfully!");
  } catch (error) {
    console.error("Error updating form data:", error);
    res.status(500).json({ error: "Internal Server Error" });
    sendNotification(userId, "❌ Error updating mail info data!");
  }
};
