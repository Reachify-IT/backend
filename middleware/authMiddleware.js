const AUTHTOKEN = process.env.AUTH_TOKEN || 123;

const validateAuthToken = (req, res, next) => {
  const { authToken } = req.body;
  if (authToken !== AUTHTOKEN) {
    return res.status(401).send({ error: "Token Incorrect" });
  }
  next();
};

module.exports = { validateAuthToken };
