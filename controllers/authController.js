const User = require("../models/User");
const Admin = require("../models/Admin");
const { hashPassword, verifyPassword, generateToken } = require("../utils/authUtils");
const { handleError } = require("../middleware/verifyToken");

const signup = async (req, res, next) => {
  try {
    const hashedPassword = await hashPassword(req.body.password);
    const newUser = new User({ ...req.body, password: hashedPassword });

    await newUser.save();
    const token = generateToken(newUser._id);
    const { password, ...otherData } = newUser._doc;

    res.status(200).json({ token, user: otherData });
  } catch (err) {
    next(err);
  }
};


const logout = async (req, res) => {
  try {
    res.cookie("token", "", { httpOnly: true, expires: new Date(0) }); // Clear the cookie
    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
};

const signin = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.body.username });

    if (!user) return next(handleError(404, "User not found"));

    const isCorrect = await verifyPassword(req.body.password, user.password);
    if (!isCorrect) return next(handleError(400, "Wrong password"));

    const token = generateToken(user._id);
    const { password, ...otherData } = user._doc;

    res.status(200).json({ token, user: otherData });
  } catch (err) {
    next(err);
  }
};

const signinAdmin = async (req, res, next) => {
  try {
    const admin = await Admin.findOne({ username: req.body.username });

    if (!admin) return next(handleError(404, "Admin not found"));

    const isCorrect = await verifyPassword(req.body.password, admin.password);
    if (!isCorrect) return next(handleError(400, "Wrong password"));

    const token = generateToken(admin._id);
    const { password, ...otherData } = admin._doc;

    res.status(200).json({ token, admin: otherData });
  } catch (err) {
    next(err);
  }
};




module.exports = { signup, signin, signinAdmin, logout };

