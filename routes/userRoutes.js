const express = require("express");
const {
  getUsers,
  removeUser,
  updatePlan,
  getPlanDetails,
  updateLimit,
} = require("../controllers/userController.js");

const router = express.Router();

router.get("/Allusers", getUsers);
router.post("/remove", removeUser);
router.post("/plan", updatePlan);
router.post("/plandetails", getPlanDetails);
router.post("/limit", updateLimit);

module.exports = router;
