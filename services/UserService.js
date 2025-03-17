const User = require("../models/User");

class UserService {
  // 🔹 Find User by Email
  static async findByEmail(email) {
    return await User.findOne({ email }).select("+password");
  }

  // 🔹 Find User by ID
  static async findById(userId) {
    return await User.findById(userId);
  }

  // 🔹 Find User by Phone Number
  static async findByPhone(phoneNumber) {
    return await User.findOne({ phoneNumber });
  }

  // 🔹 Find User by Email or Username
  static async findByEmailOrUsername(email, username) {
    return await User.findOne({ $or: [{ email }, { username }] });
  }

  // 🔹 Create New User
  static async createUser(userData) {
    return await new User(userData).save();
  }

  // 🔹 Update User Details
  static async updateUser(userId, updateData) {
    return await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    );
  }

  // 🔹 Update User Plan (Auto-Upgrade)
  static async updatePlan(userId, newPlan) {
    const user = await User.findById(userId);
    if (!user) return null;

    const updateData = { planDetails: newPlan };

    // ✅ Reset video count if upgrading from "Trial"
    if (user.planDetails === "Trial") {
      updateData.videosCount = 0;
    }

    return await User.findByIdAndUpdate(userId, updateData, { new: true });
  }

  // 🔹 Add Payment to User History
  static async addPaymentToHistory(userId, paymentData) {
    return await User.findByIdAndUpdate(
      userId,
      { $push: { paymentHistory: paymentData } }, // Append payment details
      { new: true }
    );
  }

  // 🔹 Sanitize User Data (Prevents Password Exposure)
  static sanitizeUser(user) {
    return {
      _id: user._id,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      planDetails: user.planDetails || "NoPlan",
      trialEndDate: user.trialEndDate || null, // ✅ Added trial end date
      videosCount: user.videosCount || 0,
      cameraSettings: user.cameraSettings,
      paymentHistory: user.paymentHistory || [], // Added payment history
    };
  }
}

module.exports = UserService;
