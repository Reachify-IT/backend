const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.error("❌ No Authorization header found!");
    return res.status(401).json({ message: "Unauthorized" });
  }

  jwt.verify(authHeader, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("❌ Invalid token:", err.message);
      return res.status(403).json({ message: "Invalid token" });
    }

    req.user = decoded;
    console.log(req.user) // Attach user details to req
    next();
  });
};

module.exports = { verifyToken };
