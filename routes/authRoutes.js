const express = require("express");
const { signup, signin, userDetails,updateDetails, logout, forgetpassword, resetpassword } = require("../controllers/authController");
const { verifyToken, authorizeRoles } = require("../middleware/verifyToken");
const { validateSignup, validateSignin } = require("../validators/authValidator");

const router = express.Router();

router.post("/signup", validateSignup, signup);
router.post("/signin", validateSignin, signin);
router.get("/me", verifyToken, userDetails); 
router.put("/update", verifyToken, updateDetails); 

router.post("/logout", logout);

// 🔹 Protected Route for Users
router.get("/user-dashboard", verifyToken, (req, res) => {
  res.status(200).json({ message: "User Access Granted", user: req.user });
});

// 🔹 Protected Admin Route
router.get("/admin-dashboard", verifyToken, authorizeRoles("admin"), (req, res) => {
  res.status(200).json({ message: "Admin Access Granted" });
});

router.post("/forgot-password", forgetpassword);

router.post("/reset-password/:token", resetpassword);

module.exports = router;
    