const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const { connectDB } = require("./config/db.js");
const { errorHandler } = require("./middleware/errorHandler.js");
const bodyParser = require("body-parser");
dotenv.config();
require("./config/redis");
require("./workers/videoWorker");

// Import Routes
const authRoutes = require("./routes/authRoutes.js");
const editRoutes = require("./routes/editRoutes.js");

const s3Routes = require("./routes/s3Routes.js");
const videoRoutes = require("./routes/videoRoutes.js");
const excelRoutes = require("./routes/excelRoutes.js");

// Initialize App
dotenv.config();
const app = express();

// Middlewares
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174", "http://13.126.144.181", "http://13.126.144.181:80"],
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(bodyParser.json());

app.options("*", cors());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/edit", editRoutes);

app.use("/api/s3", s3Routes);
app.use("/api/video", videoRoutes);
app.use("/api/excel", excelRoutes);

// Root Route
app.get("/", (req, res) => {
  res.send("Hello World");
});

// Error Handling Middleware
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 8000;
app.listen(PORT, async () => {
  connectDB();
  console.log(`Server running on port ${PORT}`);
});
