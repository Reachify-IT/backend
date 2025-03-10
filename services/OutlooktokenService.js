const axios = require("axios");
dotenv = require("dotenv");
dotenv.config();
const refreshOutlookToken = async (refreshToken)=> {
  const response = await axios.post(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
      })
  );

  return response.data.access_token;
}

module.exports = { refreshOutlookToken };