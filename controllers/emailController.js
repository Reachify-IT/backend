const axios = require("axios");
const Mail = require("../models/mailSchema");

const { refreshOutlookToken } = require("../services/OutlooktokenService");
const nodemailer = require("nodemailer");
const imapschema = require("../models/imapschema");

const { google } = require("googleapis");
const googlemailSchema = require("../models/googlemailSchema");

const tokenManager = require("../utils/tokenManager");
const moment = require("moment");
const { decryptPassword } = require("../utils/cryptoUtil");
const { sendNotification } = require("../services/notificationService");
const processEmailService = require("../services/APIService");
const mongoose = require("mongoose");

const EMAIL_LIMITS = [
  { days: 3, limit: 30 },
  { days: 7, limit: 70 },
  { days: 14, limit: 200 },
  { days: 30, limit: 500 },
  { days: 60, limit: 1000 }, // Example: Increase limit after 60 days
  { days: 90, limit: 2000 }, // Example: Further increase at 90 days
];

function cleanHtmlResponse(rawHtml) {
  return rawHtml
    .replace(/\\n/g, "\n") // Replace escaped newlines with actual newlines
    .replace(/\\"/g, '"') // Replace escaped quotes with actual quotes
    .replace(/\\t/g, "\t") // Replace escaped tabs with actual tabs
    .replace(/'\s*\+\s*'/g, "") // Remove concatenation symbols
    .trim(); // Remove any leading or trailing spaces
}

exports.sendBulkEmails = async ({
  email,
  userId,
  s3Url,
  Name,
  WebsiteUrl,
  ClientCompany,
  ClientDesignation,
}) => {
  try {
    console.log("🚀 Bulk Email Process Started...");

    // Convert `userId` to `ObjectId` ONLY if it's a valid ObjectId
    const ObjectId = mongoose.Types.ObjectId;
    const queryUserId = ObjectId.isValid(userId) ? new ObjectId(userId) : userId;

    console.log(`🔍 Checking Mail collection for userId: ${userId} (Type: ${typeof userId})`);
    console.log(`🔍 Final userId used for query: ${queryUserId} (Type: ${typeof queryUserId})`);

    // Fetch sender's email & OAuth tokens
    const mailEntry = await Mail.findOne({ userId: queryUserId });

    if (!mailEntry) {
      console.error(`❌ No Mail entry found for userId: ${queryUserId}`);
      console.log("🔍 Checking All Mail Entries in DB...");

      // Debug: List all entries in Mail schema
      const allUsers = await Mail.find({});
      console.log("📂 All Mail Users:", allUsers.map(user => ({
        userId: user.userId,
        email: user.email
      })));

      return { message: `User with ID ${userId} not found.` };
    }

    console.log(`✅ Found Mail Entry: ${mailEntry.email}`);

    // Check if the refresh token exists
    if (!mailEntry.refreshToken) {
      console.error("❌ No refresh token found. User must reauthenticate.");
      return { message: "User not authenticated. Please login again." };
    }

    console.log("🔄 Refreshing Outlook Access Token...");
    const accessToken = await refreshOutlookToken(mailEntry.refreshToken);

    if (!accessToken) {
      console.error("❌ Failed to refresh access token. Re-authentication required.");
      return { message: "Failed to refresh Outlook access token. Re-authentication required." };
    }

    console.log("🔑 Access Token Retrieved:", accessToken);

    let successCount = 0;
    let failureCount = 0;
    let failedEmails = [];

    // Check email sending limits
    const today = moment().startOf("day");

    if (!mailEntry.dailyEmailCount) {
      mailEntry.dailyEmailCount = { date: today.toDate(), count: 0 };
      await mailEntry.save();
    }

    // Count the number of unique days emails were sent
    const sentDays = await Mail.countDocuments({
      userId: queryUserId,
      "dailyEmailCount.count": { $gt: 0 },
    });

    // Determine email limit
    const emailLimit = EMAIL_LIMITS.find((limit) => sentDays <= limit.days)?.limit || 500;

    console.log(`📊 Total Days Sent Emails: ${sentDays} days`);
    console.log(`📈 Today's Email Limit: ${emailLimit}`);

    if (moment(mailEntry.dailyEmailCount.date).isBefore(today)) {
      if (mailEntry.dailyEmailCount.count > 0) {
        await Mail.updateOne({ userId: queryUserId }, { $inc: { totalSentDays: 1 } });
      }
      mailEntry.dailyEmailCount.date = today.toDate();
      mailEntry.dailyEmailCount.count = 0;
      await mailEntry.save();
    }

    if (mailEntry.dailyEmailCount.count >= emailLimit) {
      console.warn("⛔ Daily email limit reached.");
      sendNotification(userId, "⛔ Daily email limit reached. Try again tomorrow.");
      return { message: "Daily email limit reached. Try again tomorrow." };
    }

    console.log("📡 Preparing email content using AI service...");
    const aiResult = await processEmailService({
      userId,
      client_name: Name,
      client_company: ClientCompany,
      client_designation: ClientDesignation,
      client_mail: email,
      client_website: WebsiteUrl,
      video_path: s3Url,
    });

    const cleanedHtml = cleanHtmlResponse(aiResult.cleaned_html);
    console.log("📝 Cleaned Email Content: ", cleanedHtml);

    console.log(`📡 Sending email to ${email}...`);

    try {
      const emailPayload = {
        message: {
          subject: aiResult.subject,
          body: { contentType: "HTML", content: cleanedHtml },
          toRecipients: [{ emailAddress: { address: email } }],
          from: { emailAddress: { address: mailEntry.email } },
        },
      };

      console.log("📤 Email Payload:", JSON.stringify(emailPayload, null, 2));

      // Delay to prevent rate limiting
      await new Promise((resolve) => setTimeout(resolve, Math.random() * (10000 - 5000) + 5000));

      // Send Email via Microsoft API
      const response = await axios.post(
        "https://graph.microsoft.com/v1.0/me/sendMail",
        emailPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`✅ Email sent successfully to: ${email}`);
      sendNotification(userId, `✅ Email sent to: ${email}`);
      successCount++;

      // Update Daily Email Count
      await Mail.updateOne(
        { userId: queryUserId },
        {
          $set: { "dailyEmailCount.date": new Date() },
          $inc: { "dailyEmailCount.count": 1 },
        }
      );
    } catch (error) {
      console.error(`❌ Failed to send email to ${email}`);
      console.error("🔍 Error Details:", error.response ? error.response.data : error.message);

      sendNotification(userId, `❌ Failed to send email to ${email}`);
      failureCount++;
      failedEmails.push({ email, reason: error.message });
    }

    return {
      message: "Bulk email process completed",
      successCount,
      failureCount,
      failedEmails,
    };
  } catch (error) {
    console.error("❌ Bulk Email Error:", error.message);
    return { error: "Failed to send emails", details: error.message };
  }
};

// googleconst
exports.sendEmail = async ({
  email,
  userId,
  s3Url,
  Name,
  WebsiteUrl,
  ClientCompany,
  ClientDesignation,
}) => {
  console.log("🚀 Bulk Email Process Started...");

  console.log("🚀 email", email);

  try {
    // ✅ Fetch user email entry
    const mailEntry = await googlemailSchema.findOne({ userId });
    if (!mailEntry) {
      return {
        message:
          "User's email not registered for mailing. Please authenticate.",
      };
    }

    const senderEmail = mailEntry.email;

    // ✅ Check for Google Refresh Token
    if (!mailEntry.googleRefreshToken) {
      return { message: "No refresh token available. Please re-authenticate." };
    }

    console.log("🔄 Getting fresh access token...");
    const accessToken = await tokenManager.getAccessToken(
      senderEmail,
      mailEntry.googleRefreshToken
    );
    if (!accessToken) {
      throw new Error("Failed to retrieve a new access token");
    }
    console.log("✅ New Access Token Retrieved");

    // ✅ Set up Gmail API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // ✅ Determine today's email limit
    const today = moment().startOf("day");

    if (!mailEntry.dailyEmailCount || !mailEntry.dailyEmailCount.date) {
      mailEntry.dailyEmailCount = { date: today.toDate(), count: 0 };
      await mailEntry.save();
    }

    // ✅ Count the number of unique days where emails were sent
    const sentDays = await googlemailSchema.countDocuments({
      userId,
      "dailyEmailCount.count": { $gt: 0 }, // Only count days where emails were sent
    });

    // ✅ Find the appropriate email limit based on the sent days
    const emailLimit =
      EMAIL_LIMITS.find((limit) => sentDays <= limit.days)?.limit || 500;

    console.log(`📊 Total Days Sent Emails: ${sentDays} days`);
    console.log(`📈 Today's Email Limit: ${emailLimit}`);

    if (moment(mailEntry.dailyEmailCount.date).isBefore(today)) {
      // ✅ If the previous day's count was greater than 0, it means an email was sent on that day
      if (mailEntry.dailyEmailCount.count > 0) {
        await googlemailSchema.updateOne(
          { userId },
          { $inc: { totalSentDays: 1 } } // ✅ Increment the unique sent days counter
        );
      }
      mailEntry.dailyEmailCount.date = today.toDate();
      mailEntry.dailyEmailCount.count = 0;
      await mailEntry.save();
    }

    // ✅ Stop if the limit is reached
    if (mailEntry.dailyEmailCount.count >= emailLimit) {
      console.warn("⛔ Daily email limit reached.");
      sendNotification(
        userId,
        "⛔ Daily email limit reached. Try again tomorrow."
      );
      return { message: "Daily email limit reached. Try again tomorrow." };
    }

    const airesult = await processEmailService({
      userId,
      client_name: Name,
      client_company: ClientCompany,
      client_designation: ClientDesignation,
      client_mail: email,
      client_website: WebsiteUrl,
      video_path: s3Url,
    });

    const cleanedHtml = cleanHtmlResponse(airesult.cleaned_html);
    console.log("cleanedHtml: ", cleanedHtml);

    console.log("📩 AI Result:", airesult);

    console.log(`📨 Sending email to: ${email}`);

    // ✅ Construct Email Template
    const htmlEmailTemplate = `
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; background-color: #fff; text-align: center; }
            h2 { font-size: 18px; color: #333; margin-bottom: 10px; }
            p { font-size: 14px; line-height: 20px; color: #666; }
            .cta-button { 
                display: inline-block; 
                background-color: #4CAF50; 
                color: white; 
                padding: 10px 20px; 
                text-decoration: none; 
                font-size: 16px; 
                border-radius: 5px;
                margin: 10px 0;
            }
            .cta-button:hover { background-color: #45a049; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Time to Elevate Your Website, ${email}!</h2>
            <h1 style="font-size: 24px; font-weight: bold; color: #1E40AF;">Mail Info</h1>
            <p>Your website has great potential. Let's optimize it together!</p>
            <a href="${s3Url}" class="cta-button">Show Video</a> <br>
            <a href="https://www.reachifyinnovations.com/contactus" class="cta-button">Schedule a Call</a>
        </div>
    </body>
    </html>`;

    // ✅ Construct Raw Email
    const message = [
      `From: ${senderEmail}`,
      `To: ${email}`,
      `Subject: ${airesult.subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "",
      cleanedHtml,
    ].join("\n");

    // ✅ Base64 Encode Email
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    try {
      // ✅ Delay 5-10 sec to avoid rate limits
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * (10000 - 5000) + 5000)
      );

      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encodedMessage },
      });

      console.log(`✅ Email sent to: ${email}`);
      sendNotification(userId, `✅ Email sent to: ${email}`);

      // ✅ Update Daily Email Count
      await googlemailSchema.updateOne(
        { userId },
        {
          $set: { "dailyEmailCount.date": new Date() },
          $inc: { "dailyEmailCount.count": 1 },
        }
      );

      return {
        message: "Email sent successfully",
        emailSent: email,
      };
    } catch (error) {
      console.error(`❌ Failed to send email to ${email}:`, error.message);
      sendNotification(userId, `❌ Failed to send email to ${email}`);
      return {
        message: "Failed to send email",
        emailFailed: email,
        reason: error.message,
      };
    }
  } catch (error) {
    console.error("❌ Bulk Email Error:", error.message);
    return { error: "Failed to send bulk emails", details: error.message };
  }
};

// sendEmailIMAP
exports.sendEmailIMAP = async ({
  email,
  userId,
  s3Url,
  Name,
  WebsiteUrl,
  ClientCompany,
  ClientDesignation,
}) => {
  console.log(
    "in mail controller",
    email,
    Name,
    WebsiteUrl,
    ClientCompany,
    ClientDesignation
  );
  console.log("🚀 IMAP Bulk Email Process Started...");
  try {
    let imapConfig = await imapschema.findOne({ userId });
    if (!imapConfig) throw new Error("IMAP configuration not found");

    const decryptedPassword = decryptPassword(imapConfig.password);
    if (!imapConfig.email || !decryptedPassword)
      throw new Error("SMTP credentials missing");

    // ✅ Determine today's email limit
    const today = moment().startOf("day");

    if (!imapConfig.dailyEmailCount) {
      imapConfig = new imapschema({
        userId,
        dailyEmailCount: { date: today.toDate(), count: 0 },
      });
      await imapConfig.save();
    }
    // ✅ Count the number of unique days where emails were sent
    const sentDays = await imapschema.countDocuments({
      userId,
      "dailyEmailCount.count": { $gt: 0 }, // Only count days where emails were sent
    });

    // ✅ Find the appropriate email limit based on the sent days
    const emailLimit =
      EMAIL_LIMITS.find((limit) => sentDays <= limit.days)?.limit || 500;

    console.log(`📊 Total Days Sent Emails: ${sentDays} days`);
    console.log(`📈 Today's Email Limit: ${emailLimit}`);

    if (moment(imapConfig.dailyEmailCount.date).isBefore(today)) {
      // ✅ If the previous day's count was greater than 0, it means an email was sent on that day
      if (imapConfig.dailyEmailCount.count > 0) {
        await imapschema.updateOne(
          { userId },
          { $inc: { totalSentDays: 1 } } // ✅ Increment the unique sent days counter
        );
      }
      imapConfig.dailyEmailCount.date = today.toDate();
      imapConfig.dailyEmailCount.count = 0;
      await imapConfig.save();
    }

    // ✅ Fetch updated count after reset
    imapConfig = await imapschema.findOne({ userId });

    // ✅ Stop if the limit is reached
    if (imapConfig.dailyEmailCount.count >= emailLimit) {
      console.warn("⛔ Daily email limit reached.");
      sendNotification(
        userId,
        "⛔ Daily email limit reached. Try again tomorrow."
      );
      return { message: "Daily email limit reached. Try again tomorrow." };
    }

    // Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      host: imapConfig.smtpHost,
      port: imapConfig.smtpPort,
      secure: imapConfig.smtpPort === 465,
      auth: {
        user: imapConfig.email,
        pass: decryptedPassword,
      },
    });

    let successCount = 0;
    let failureCount = 0;
    let failedEmails = [];

    if (successCount >= emailLimit) return { message: "Email limit reached" };

    const airesult = await processEmailService({
      userId,
      client_name: Name,
      client_company: ClientCompany,
      client_designation: ClientDesignation,
      client_mail: email,
      client_website: WebsiteUrl,
      video_path: s3Url,
    });

    const rawHtml = airesult.cleaned_html;

    // const cleanedHtml = cleanHtmlResponse(rawHtml);
    const cleanedHtml = rawHtml.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

    // console.log(formattedHtml);
    console.log("📩 AI Result:", airesult);
    console.log("cleanedHtml: ", cleanedHtml);

    console.log(`📨 Sending email to: ${email}`);

    // Email Template
    const htmlEmailTemplate = `
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; background-color: #fff; text-align: center; }
            h2 { font-size: 18px; color: #333; margin-bottom: 10px; }
            p { font-size: 14px; line-height: 20px; color: #666; }
            .cta-button { 
                display: inline-block; 
                background-color: #4CAF50; 
                color: white; 
                padding: 10px 20px; 
                text-decoration: none; 
                font-size: 16px; 
                border-radius: 5px;
                margin: 10px 0;
            }
            .cta-button:hover { background-color: #45a049; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Time to Elevate Your Website, ${email}!</h2>
            <h1 style="font-size: 24px; font-weight: bold; color: #1E40AF;">Mail Info</h1>
            
            <p>Your website has great potential. Let's optimize it together!</p>
            
            <a href="${s3Url}" class="cta-button">Show Video</a> <br>
            
            <a href="https://www.reachifyinnovations.com/contactus" class="cta-button">Schedule a Call</a>
        </div>
    </body>
    </html>`;

    const mailOptions = {
      from: imapConfig.email,
      to: email,
      subject: airesult.subject,
      html: cleanedHtml,
    };

    try {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * (10000 - 5000) + 5000)
      );
      await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully to ${email}`);
      sendNotification(userId, `✅ Email sent successfully to ${email}`);
      successCount++;
      // ✅ Atomic Update to Prevent Race Conditions
      await imapschema.updateOne(
        { userId, "dailyEmailCount.count": { $lt: emailLimit } },
        {
          $set: { "dailyEmailCount.date": new Date() },
          $inc: { "dailyEmailCount.count": 1 },
        }
      );
    } catch (err) {
      console.error(`❌ Failed to send email to ${email}:`, err);
      sendNotification(
        userId,
        `❌ Failed to send email to ${email}: ${err.message}`
      );
      failureCount++;
      failedEmails.push({ email: email, reason: err.message });
    }

    return {
      message: `${successCount} Email(s) sent successfully`,
      successCount,
      failureCount,
      failedEmails,
    };
  } catch (error) {
    console.error("❌ Error sending emails:", error);
    return { error: error.message };
  }
};

exports.getEmailInfoGoogle = async (req, res) => {
  try {
    const userId = req.user.id;
    const emailRecord = await googlemailSchema.findOne({ userId });

    if (!emailRecord) {
      return res.status(200).json({
        status: "success",
        email: null,
        message: "No email found",
        // Return null if no email is found
      });
    }

    res.status(200).json({
      status: "success",
      email: emailRecord.email, // Return the found email
    });
  } catch (error) {
    console.error("❌ Get Email Info Error:", error.message);
    res.status(500).json({ error: "Failed to get email info" });
  }
};

exports.getEmailInfo = async (req, res) => {
  try {
    const userId = req.user.id;

    const mailSchema = await Mail.findOne({ userId });

    if (!mailSchema) {
      return res.status(200).json({
        status: "success",
        email: null,
        message: "No email found",
      });
    }

    const email = mailSchema.email;

    res.status(200).json({
      status: "success",
      email: email,
    });
  } catch (error) {
    console.error("❌ Get Email Info Error:", error.message);
    res.status(500).json({ error: "Failed to get email info" });
  }
};

exports.getEmailInfoIMAP = async (req, res) => {
  try {
    const userId = req.user.id;
    const imapConfig = await imapschema.findOne({ userId });

    if (!imapConfig) {
      return res.status(200).json({
        status: "success",
        email: null,
        message: "No email found",
      });
    }

    const email = imapConfig.email;

    res.status(200).json({
      status: "success",
      email: email,
    });
  } catch (error) {
    console.error("❌ Get Email Info Error:", error.message);
    res.status(500).json({ error: "Failed to get email info" });
  }
};
