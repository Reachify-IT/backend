const mongoose = require("mongoose");

const DynamicSchema = new mongoose.Schema({}, { strict: false });

module.exports = mongoose.model("DynamicModel", DynamicSchema);
