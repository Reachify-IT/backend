const express = require("express");
const { signup, signin, signinAdmin, logout } = require("../controllers/authController");
const { verifyToken } = require("../middleware/verifyToken");

const router = express.Router();

router.post("/signup", signup);
router.post("/logout", logout);
router.post("/signin", signin);
router.post("/admin/signin", signinAdmin);


// Example of a protected route
router.get("/protected", verifyToken, (req, res) => {
  res.json({ message: "Access granted", user: req.user });
});

module.exports = router;
