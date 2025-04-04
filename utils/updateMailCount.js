const MailCount = require("../models/mailCount");

const updateMailCount = async (userId, isSuccess) => {
  try {
    const updateField = isSuccess ? { $inc: { successMails: 1 } } : { $inc: { failedMails: 1 } };
    
    await MailCount.findOneAndUpdate(
      { userId },
      updateField,
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("Error updating mail count:", error);
  }
};

module.exports = { updateMailCount };
