const User = require("../models/User");

class UserService {
  // 🔹 Find User by Email
  static async findByEmail(email) {
    return await User.findOne({ email }).select("+password");
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

  // 🔹 Sanitize User Data (Prevents Password Exposure)
  static sanitizeUser(user) {
    return {
      _id: user._id,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber, // Added phone number
      role: user.role,
      planDetails: user.planDetails || "NoPlan",
    };
  }
}

module.exports = UserService;
