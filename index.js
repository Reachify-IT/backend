const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const { connectDB } = require("./config/db.js");
const { errorHandler } = require("./middleware/errorHandler.js");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const compression = require("compression");
const winston = require("winston");

dotenv.config();
require("./config/redis");
require("./workers/videoWorker");

// Import Routes
const authRoutes = require("./routes/authRoutes.js");
const editRoutes = require("./routes/editRoutes.js");
const excelRoutes = require("./routes/excelRoutes.js");
const feedbackRoutes = require("./routes/feedbackRoutes");
const { initSocket } = require("./services/notificationService.js");
const userRoutes = require("./routes/userRoutes.js");

// Initialize App
const app = express();
const server = http.createServer(app);

// Logger Setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

// Security & Performance Middlewares
app.use(helmet()); // Security headers
app.use(compression()); // Response compression

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Allow preflight requests
app.options("*", cors());

// Socket.io Setup
const io = new Server(server,
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }) 
);
io.on("connection", (socket) => {
  logger.info("A user connected: " + socket.id);

  socket.on("disconnect", () => {
    logger.info("User disconnected: " + socket.id);
  });
});

// Initialize the notification service
initSocket(io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/edit", editRoutes);
app.use("/api/excel", excelRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/users", userRoutes);

// Root Route
app.get("/", (req, res) => {
  res.send("Hello World");
});

// Error Handling Middleware
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 8000;
server.listen(PORT, async () => {
  await connectDB();
  logger.info(`🚀 Server running on port ${PORT}`);
});