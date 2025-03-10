const { PublicClientApplication } = require('@azure/msal-node');
require('dotenv').config();

const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/common`,
        clientSecret: process.env.CLIENT_SECRET,
    }
};

const msalInstance = new PublicClientApplication(msalConfig);

module.exports = msalInstance;
