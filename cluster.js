const cluster = require("cluster");
const os = require("os");
const winston = require("winston");
const { startServer } = require("./server");

const numCPUs = os.cpus().length; // Get number of CPU cores

// Logger Setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

if (cluster.isMaster) {
  logger.info(`Master process ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Restart worker if it exits
  cluster.on("exit", (worker) => {
    logger.error(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  startServer(); // Start server in worker process
}
