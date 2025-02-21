const express = require("express");
const { signup, signin,  logout } = require("../controllers/authController");
const { verifyToken, authorizeRoles } = require("../middleware/verifyToken");
const { validateSignup, validateSignin } = require("../validators/authValidator");

const router = express.Router();

router.post("/signup", validateSignup, signup);
router.post("/signin", validateSignin, signin);

router.post("/logout", logout);

// 🔹 Protected Route for Users
router.get("/user-dashboard", verifyToken, (req, res) => {
  res.status(200).json({ message: "User Access Granted", user: req.user });
});

// 🔹 Protected Admin Route
router.get("/admin-dashboard", verifyToken, authorizeRoles("admin"), (req, res) => {
  res.status(200).json({ message: "Admin Access Granted" });
});

module.exports = router;
    