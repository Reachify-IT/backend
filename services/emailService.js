const nodemailer = require("nodemailer");
const { getAccessToken } = require("../config/googleAuth");
require("dotenv").config();

const sendEmail = async (to, subject, text, html) => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Failed to generate access token");

    // 🔹 Configure Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.GMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        accessToken,
      },
    });

    // 🔹 Email Options
    const mailOptions = {
      from: `"My App" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    };

    // 🔹 Send Email
    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", result.messageId);
    return result;
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);
    return null;
  }
};

module.exports = sendEmail;
