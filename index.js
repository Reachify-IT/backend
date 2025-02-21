const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const { connectDB } = require("./config/db.js");
const { errorHandler } = require("./middleware/errorHandler.js");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();
require("./config/redis");
require("./workers/videoWorker"); // ✅ Load workers AFTER initializing the app

// Import Routes
const authRoutes = require("./routes/authRoutes.js");
const editRoutes = require("./routes/editRoutes.js");
const videoRoutes = require("./routes/videoRoutes.js");
const excelRoutes = require("./routes/excelRoutes.js");
const feedbackRoutes = require("./routes/feedbackRoutes");
const { initSocket } = require("./services/notificationService.js");

require("./workers/videoWorker");

// Initialize App
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Adjust this in production
    methods: ["GET", "POST"]
  }
});


io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});


// Initialize the notification service
initSocket(io);


// Middlewares
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174", "http://3.110.166.59", "http://3.110.166.59:80"],
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
app.use("/api/video", videoRoutes);
app.use("/api/excel", excelRoutes);
app.use("/api/feedback", feedbackRoutes);

// Root Route
app.get("/", (req, res) => {
  res.send("Hello World");
});

// Error Handling Middleware
app.use(errorHandler);



// Start Server
const PORT = process.env.PORT || 8000;
server.listen(PORT, async () => {
  connectDB();
  console.log(`Server running on port ${PORT}`);
});

