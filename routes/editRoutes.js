const express = require("express");
const { emailChange, passChange, planChange, planSelection } = require("../controllers/edit.js");

const router = express.Router();

router.put("/email/:id", emailChange);
router.put("/pass/:id", passChange);
router.put("/plan/:id", planChange);
router.post("/planselection/:id", planSelection);

module.exports = router;
