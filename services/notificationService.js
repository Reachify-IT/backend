let ioInstance = null;

const initSocket = (io) => {
  ioInstance = io;
};

const sendNotification = (message) => {
  if (ioInstance) {
    ioInstance.emit("notification", { message });
  } else {
    console.error("Socket.IO instance not initialized!");
  }
};

module.exports = { initSocket, sendNotification };
