const { startServer } = require("./server");

if (process.env.USE_CLUSTER === "true") {
  require("./cluster");
} else {
  startServer();
}
