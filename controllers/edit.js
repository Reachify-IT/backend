const User = require("../models/User.js");
const bcrypt = require("bcryptjs");
const { handleError } = require("../middleware/errorHandler.js");

// 🔹 Generic function to update user fields
const updateUser = async (req, res, next, updateFields) => {
  try {
    if (req.params.id !== req.body.id) {
      return next(handleError(403, "You can update only your account"));
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedUser) return next(handleError(404, "User not found"));

    res.status(200).json({ message: "Update successful", updatedUser });
  } catch (err) {
    next(err);
  }
};

// 🔹 Change Email (Only if Changed)
const emailChange = async (req, res, next) => {
  try {
    const { id, email } = req.body;

    if (req.params.id !== id) {
      return next(handleError(403, "You can update only your account"));
    }

    const user = await User.findById(req.params.id);
    if (!user) return next(handleError(404, "User not found"));

    // ✅ Check if email is the same
    if (user.email === email) {
      return res.status(200).json({ message: "No changes detected" });
    }

    // ✅ Update email only if it's different
    await updateUser(req, res, next, { email });
  } catch (err) {
    next(err);
  }
};

// 🔹 Change Password (Ensures Proper Verification)
const passChange = async (req, res, next) => {
  try {
    const { id, currpassword, password } = req.body;

    if (req.params.id !== id) {
      return next(handleError(403, "You can update only your account"));
    }

    // ✅ Fetch user with password field explicitly selected
    const user = await User.findById(req.params.id).select("+password");
    if (!user) return next(handleError(404, "User not found"));

    // ✅ Ensure the password exists before comparing
    if (!user.password) return next(handleError(500, "User password not found"));

    // Verify current password
    const isCorrect = await bcrypt.compare(currpassword, user.password);
    if (!isCorrect) return next(handleError(403, "Wrong password"));

    // ✅ Check if the new password is the same as the old one
    const isSamePassword = await bcrypt.compare(password, user.password);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password cannot be the same as the old password" });
    }

    // Hash the new password
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    // ✅ Update the password
    await updateUser(req, res, next, { password: hash });
  } catch (err) {
    next(err);
  }
};

// 🔹 Change Plan
const planChange = (req, res, next) => updateUser(req, res, next, { plan: req.body.plan });

// 🔹 Select Plan
const planSelection = (req, res, next) => updateUser(req, res, next, req.body);

module.exports = { emailChange, passChange, planChange, planSelection };
