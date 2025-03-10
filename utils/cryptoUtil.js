const CryptoJS = require("crypto-js");

// Store this key securely (e.g., in an environment variable)
const SECRET_KEY = process.env.SECRET_KEY ;

exports.encryptPassword = (password) => {
  return CryptoJS.AES.encrypt(password, SECRET_KEY).toString();
};


exports.decryptPassword = (encryptedPassword) => {
  const bytes = CryptoJS.AES.decrypt(encryptedPassword, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

