const handleError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.message = message;
  return error;
};

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal Server Error" });
};

module.exports = { handleError, errorHandler };
