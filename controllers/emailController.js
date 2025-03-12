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
const { default: processEmailService } = require("../services/APIService");

const EMAIL_LIMITS = [
  { days: 3, limit: 30 },
  { days: 7, limit: 70 },
  { days: 14, limit: 200 },
  { days: 30, limit: 500 },
  { days: 60, limit: 1000 }, // Example: Increase limit after 60 days
  { days: 90, limit: 2000 }, // Example: Further increase at 90 days
];

// microsoftGraph
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

    // ✅ Fetch sender's email & OAuth tokens
    const mailEntry = await Mail.findOne({ userId });
    if (!mailEntry || !mailEntry.refreshToken) {
      return { message: "User not authenticated. Please login again." };
    }

    console.log(`📩 Using email: ${mailEntry.email}`);

    // ✅ Refresh Outlook Access Token
    const accessToken = await refreshOutlookToken(mailEntry.refreshToken);
    if (!accessToken) {
      return {
        message:
          "Failed to refresh Outlook access token. Re-authentication required.",
      };
    }

    // ✅ Determine today's email limit
    const today = moment().startOf("day");
    if (!mailEntry.dailyEmailCount) {
      mailEntry.dailyEmailCount = { date: today.toDate(), count: 0 };
      await mailEntry.save();
    }

    // ✅ Count the number of unique days where emails were sent
    const sentDays = await Mail.countDocuments({
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
        await Mail.updateOne(
          { userId },
          { $inc: { totalSentDays: 1 } } // ✅ Increment the unique sent days counter
        );
      }
      mailEntry.dailyEmailCount.date = today.toDate();
      mailEntry.dailyEmailCount.count = 0;
      await mailEntry.save();
    }

    if (mailEntry.dailyEmailCount.count >= emailLimit) {
      console.warn("⛔ Daily email limit reached.");
      sendNotification(
        userId,
        "⛔ Daily email limit reached. Try again tomorrow."
      );
      return { message: "Daily email limit reached. Try again tomorrow." };
    }

    // ✅ Read Excel & Extract Data
    const emailDataList = processExcel(filePath);
    if (!emailDataList.length) {
      return { message: "No valid email data found in the Excel file." };
    }

    console.log(`✅ Found ${emailDataList.length} valid email entries.`);

    if (successCount >= emailLimit) return { message: "Email limit reached" };

    const airesult = await processEmailService({
      my_company: "Reachify Innovations",
      my_designation: "CTO",
      my_name: "Abhinav Dogra",
      my_mail: "info@reachifyinnovations.com",
      my_work: "Software development and website optimization",
      my_cta_link: "https://www.reachifyinnovations.com/contactus",
      client_name: Name,
      client_company: ClientCompany,
      client_designation: ClientDesignation,
      client_mail: email,
      client_website: WebsiteUrl,
      video_path: s3Url,
    });

    console.log("📩 AI Result:", airesult);

    console.log("📩 Sending emails...");

    let successCount = 0;
    let failureCount = 0;
    let failedEmails = [];

    console.log(`📡 Calling processEmailService for ${emailData.Email}...`);

    // ✅ Send Emails for Each Entry
    for (const emailData of emailDataList) {
      try {
        // ✅ Prepare Email Data for Microsoft Outlook API
        const emailPayload = {
          message: {
            subject: airesult.subject,
            body: { contentType: "HTML", content: airesult.cleaned_html },
            toRecipients: [{ emailAddress: { address: emailData.Email } }],
            from: { emailAddress: { address: mailEntry.email } },
          },
        };

        // ✅ Introduce Delay (Prevent Outlook Rate Limiting)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * (10000 - 5000) + 5000)
        );

        // ✅ Send Email
        await axios.post(
          "https://graph.microsoft.com/v1.0/me/sendMail",
          emailPayload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log(`✅ Email sent to: ${emailData.Email}`);
        sendNotification(userId, `✅ Email sent to: ${emailData.Email}`);
        successCount++;

        // ✅ Update Daily Email Count
        await Mail.updateOne(
          { userId },
          {
            $set: { "dailyEmailCount.date": new Date() },
            $inc: { "dailyEmailCount.count": 1 },
          }
        );
      } catch (error) {
        console.error(
          `❌ Failed to send email to ${emailData.Email}:`,
          error.message
        );
        sendNotification(
          userId,
          `❌ Failed to send email to ${emailData.Email}`
        );
        failureCount++;
        failedEmails.push({ email: emailData.Email, reason: error.message });
      }
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
      my_company: "Reachify Innovations",
      my_designation: "CTO",
      my_name: "Abhinav Dogra",
      my_mail: "info@reachifyinnovations.com",
      my_work: "Software development and website optimization",
      my_cta_link: "https://www.reachifyinnovations.com/contactus",
      client_name: Name,
      client_company: ClientCompany,
      client_designation: ClientDesignation,
      client_mail: email,
      client_website: WebsiteUrl,
      video_path: s3Url,
    });

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
      airesult.cleaned_html,
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

    if (moment(mailEntry.dailyEmailCount.date).isBefore(today)) {
      // ✅ If the previous day's count was greater than 0, it means an email was sent on that day
      if (mailEntry.dailyEmailCount.count > 0) {
        await imapschema.updateOne(
          { userId },
          { $inc: { totalSentDays: 1 } } // ✅ Increment the unique sent days counter
        );
      }
      mailEntry.dailyEmailCount.date = today.toDate();
      mailEntry.dailyEmailCount.count = 0;
      await mailEntry.save();
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
      my_company: "Reachify Innovations",
      my_designation: "CTO",
      my_name: "Abhinav Dogra",
      my_mail: "info@reachifyinnovations.com",
      my_work: "Software development and website optimization",
      my_cta_link: "https://www.reachifyinnovations.com/contactus",
      client_name: Name,
      client_company: ClientCompany,
      client_designation: ClientDesignation,
      client_mail: email,
      client_website: WebsiteUrl,
      video_path: s3Url,
    });

    console.log("📩 AI Result:", airesult);

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
      html: airesult.cleaned_html,
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
