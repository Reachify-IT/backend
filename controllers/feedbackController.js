const Feedback = require("../models/feedback");

// 🔹 Submit Feedback
const submitFeedback = async (req, res) => {
  try {
    const { name, email, description, rating } = req.body;
    const userId = req.user.id; 

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const feedback = new Feedback({ userId, name, email, description, rating });
    await feedback.save();

    res.status(201).json({ message: "Feedback submitted successfully", feedback });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};



module.exports = { submitFeedback};
