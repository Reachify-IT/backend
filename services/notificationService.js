let ioInstance = null;
const userSockets = new Map(); // Store user ID -> Socket ID

const initSocket = (io) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Listen for user login to associate socket with user ID
    socket.on("registerUser", (userId) => {
      userSockets.set(userId, socket.id);
      console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
      for (let [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          console.log(`User ${userId} removed from tracking.`);
          break;
        }
      }
    });
  });
};

const sendNotification = (userId, message) => {
  console.log(`Sending notification to User ${userId}`);
  console.log(`Message: ${message}`);
  if (ioInstance) {
    const socketId = userSockets.get(userId);
    if (socketId) {
      ioInstance.to(socketId).emit("notification", { message });
      console.log(`Sent notification to User ${userId}: ${message}`);
    } else {
      console.error(`User ${userId} is not connected.`);
    }
  } else {
    console.error("Socket.IO instance not initialized!");
  }
};

module.exports = { initSocket, sendNotification };
