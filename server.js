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
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");
const { initSocket } = require("./services/notificationService.js");

dotenv.config();

// Initialize Express App
const app = express();
require("./workers/videoWorker");
const server = http.createServer(app);

// Logger Setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

// Middleware Setup
app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(","), credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.options("*", cors()); // Preflight requests

// Import Routes
app.use("/api/auth", require("./routes/authRoutes.js"));
app.use("/api/edit", require("./routes/editRoutes.js"));
app.use("/api/excel", require("./routes/excelRoutes.js"));
app.use("/api/feedback", require("./routes/feedbackRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/oauth", require("./routes/Oauth.js"));
app.use("/api/email", require("./routes/emailRoutes"));
app.use("/api/imap", require("./routes/imapRoutes"));
app.use("/api/otp", require("./routes/otpRoutes"));
app.use("/api/folder", require("./routes/folderRoutes"));
// app.use("/api/payments1", require("./routes/paypalRoutes"));
// Root Route
app.get("/", (req, res) => res.send("Hello World"));

// Error Handling Middleware
app.use(errorHandler);

// Initialize Redis for Pub/Sub
const pubClient = new Redis(process.env.REDIS_URL, {
  tls: { rejectUnauthorized: false },
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  reconnectOnError: (err) => {
    console.error("❌ Redis Connection Error:", err.message);
    return true;
  },
});

const subClient = pubClient.duplicate();

const startServer = () => {
  Promise.all([pubClient.ping(), subClient.ping()])
    .then(() => {
      const io = new Server(server, {
        cors: {
          origin: ["http://localhost:5173", "http://localhost:5174", "https://loomifyinnovations.com"],
          allowedHeaders: ["Content-Type", "Authorization"],
          credentials: true,
        },
        transports: ["websocket", "polling"],
      });

      io.adapter(createAdapter(pubClient, subClient));

      initSocket(io);

      io.on("connection", (socket) => {
        logger.info(`User connected: ${socket.id}`);
        socket.on("disconnect", () => {
          logger.info(`User disconnected: ${socket.id}`);
        });
      });

      // Start Server after Redis Connection is Established
      const PORT = process.env.PORT || 8000;
      server.listen(PORT, async () => {
        await connectDB();
        logger.info(`🚀 Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      logger.error("❌ Failed to connect to Redis:", err);
      process.exit(1);
    });

  pubClient.on("connect", () => console.log("✅ Redis client connected!"));
  pubClient.on("error", (err) => console.error("❌ Redis connection error:", err));
};

module.exports = { startServer };
