const { google } = require("googleapis");
const oauth2Client = require("../config/googleAuth");
const Mail = require("../models/googlemailSchema");

exports.getAccessToken = async (email, refreshToken) => {
  try {
    console.log(`🔄 Refreshing access token for ${email}...`);

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // ✅ Correct way to refresh the access token
    const newAccessToken = await oauth2Client.getAccessToken();

    if (!newAccessToken || !newAccessToken.token) {
      throw new Error("Failed to retrieve a new access token");
    }

    console.log("✅ New Access Token:", newAccessToken.token);

    // Save the updated access token in DB
    await Mail.findOneAndUpdate(
      { email },
      { googleAccessToken: newAccessToken.token }
    );

    return newAccessToken.token;
  } catch (error) {
    console.error("❌ Failed to refresh access token:", error.message);
    throw new Error("Failed to refresh access token. Please re-authenticate.");
  }
};
