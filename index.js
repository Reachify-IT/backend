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


// Import Routes
const authRoutes = require("./routes/authRoutes.js");
const editRoutes = require("./routes/editRoutes.js");
const excelRoutes = require("./routes/excelRoutes.js");
const feedbackRoutes = require("./routes/feedbackRoutes");
const userRoutes = require("./routes/userRoutes");
const Oauth = require("./routes/Oauth.js");
const emailRoutes =  require("./routes/emailRoutes");
const imapRoutes = require("./routes/imapRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const {initSocket } = require("./services/notificationService.js");


// Initialize App
const app = express();
require("./config/redis");
require("./workers/videoWorker");
const server = http.createServer(app);

// Logger Setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    // new winston.transports.File({ filename: "error.log", level: "error" }),
    // new winston.transports.File({ filename: "combined.log" }),
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

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174","http://frontend.reachifyinnovations.in"], // ✅ Ensure CORS is properly set
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

// Socket.io Setup
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

app.use("/api/payments", paymentRoutes);
app.use("/api/oauth", Oauth);
app.use("/api/email", emailRoutes);
app.use("/api/imap", imapRoutes);



// http://localhost:8000/mail/auth/callback

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