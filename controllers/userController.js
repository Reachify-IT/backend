const User = require("../models/User.js");

exports.getUsers = async (req, res) => {
  try {
    const currentUsers = await User.find({});
    res.json(currentUsers);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.removeUser = async (req, res) => {
  const { username } = req.body;
  try {
    await User.findOneAndDelete({ username });
    res.json({ message: "User removed successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.updatePlan = async (req, res) => {
  const { username, plan } = req.body;
  try {
    await User.updateOne({ username }, { plandetails: plan });
    res.json({ message: "Plan updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};




