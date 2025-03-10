const cluster = require("cluster");
const os = require("os");
const winston = require("winston");

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
  cluster.on("exit", (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died. Starting a new worker...`);
    cluster.fork();
  });
} else {
  require("./index.js"); // Start the Express server in worker process
}

logger.info(`Worker process ${process.pid} started`);