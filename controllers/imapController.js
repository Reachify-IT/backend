const bcrypt = require("bcryptjs");
const Imap = require("node-imap");
const nodemailer = require("nodemailer");
const ImapSchema = require("../models/imapschema"); // Use PascalCase for model naming
const { encryptPassword } = require("../utils/cryptoUtil");
const { sendNotification } = require("../services/notificationService");

const authenticateIMAP = async ({ email, password, imapHost, imapPort }) => {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: email,
      password: password,
      host: imapHost,
      port: imapPort,
      tls: true, // Most IMAP servers require TLS
    });

    imap.once("ready", () => {
      imap.end();
      resolve(true);
    });

    imap.once("error", (err) => {
      reject(err);
    });

    imap.connect();
  });
};



const authenticateSMTP = async ({ email, password, smtpHost, smtpPort }) => {
  return new Promise((resolve, reject) => {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort, // True for port 465, false for 587/25
      auth: {
        user: email,
        pass: password,
      },
    });

    transporter.verify((error, success) => {
      if (error) {
        reject(new Error(`SMTP Authentication Failed: ${error.message}`));
      } else {
        resolve(true);
      }
    });
  });
};


exports.verificationIMAP = async (req, res) => {
  const userId = req.user.id;
  try {
    const { email, password, imapHost, imapPort } = req.body;

    // Validate required fields
    if (!email || !password || !imapHost || !imapPort) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Validate IMAP credentials before proceeding
    try {
      await authenticateIMAP({ email, password, imapHost, imapPort });
      console.log("✅ IMAP credentials are valid");
      sendNotification(userId, "✅ IMAP sccessfully configured");

    } catch (error) {
      console.error("❌ IMAP Authentication Error:", error);
      sendNotification(userId, "❌ Invalid IMAP credentials, Please try again");
      return res.status(400).json({ error: "Invalid IMAP credentials" });
    }

    res.status(200).json({ message: "IMAP configuration saved successfully!" });
  } catch (error) {
    console.error("❌ IMAP Configuration Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


exports.configureIMAP = async (req, res) => {
  let userId;
  try {
    const { email, password, imapHost, imapPort, smtpHost, smtpPort, replyTo, my_company, my_designation, my_name, my_mail, my_work, my_cta_link } = req.body;
    const userId = req.user.id;


    console.log("🔑 Received IMAP credentials:", { email, password, imapHost, imapPort, smtpHost, smtpPort, replyTo });

    if (!email || !password || !imapHost || !imapPort) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Validate IMAP credentials before saving
    try {
      await authenticateSMTP({ email, password, smtpHost, smtpPort });
      console.log("✅ SMTP credentials are valid");
      sendNotification(userId, "✅ SMTP sccessfully configured");

    } catch (error) {
      console.error("❌ Invalid SMTP credentials:");
      return res.status(400).json({ error: "Invalid IMAP credentials" });
    }


    const existingUser = await ImapSchema.findOne({ userId });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "IMAP configuration already exists for this user" });
    } 

    // Encrypt password before storing
    // const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPassword = encryptPassword(password);
    console.log("hashedPassword", hashedPassword);


    console.log("🔑 IMAP credentials are valid, saving in database...");
    // Create new user
    const user = new ImapSchema({
      userId,
      email,
      password: hashedPassword,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      replyTo,
      formMailData: {
        my_company,
        my_designation,
        my_name,
        my_mail,
        my_work,
        my_cta_link,
      },
    });

    console.log("user", user);



    await user.save();

    sendNotification(userId, "✅ IMAP/SMTP sccessfully configured");

    res.status(200).json({ 
      success: true,
      message: "IMAP configuration saved successfully!" });
  } catch (error) {
    console.error("❌ IMAP Configuration Error:", error);
    sendNotification(userId, "❌ IMAP Configuration Failed, Please try again");
    res.status(500).json({ error: "Internal server error" });
  }
};
