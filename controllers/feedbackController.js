const Feedback = require("../models/feedback");
const { sendNotification } = require("../services/notificationService");

// 🔹 Submit Feedback
const submitFeedback = async (req, res) => {
  let userId;
  try {
    const { name, email, description, rating } = req.body;
    const userId = req.user.id; 

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const feedback = new Feedback({ userId, name, email, description, rating });
    await feedback.save();

    sendNotification(userId, "✅ Feedback submitted successfully!");

    res.status(201).json({ message: "Feedback submitted successfully", feedback });
  } catch (err) {
    if (userId){
      sendNotification(userId, "❌ Feedback submitted failed!");
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};



module.exports = { submitFeedback};
