const mongoose = require("mongoose");

const MailInfoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  my_company: { type: String, required: true },
  my_designation: { type: String, required: true },
  my_name: { type: String, required: true },
  my_mail: { type: String, required: true },
  my_work: { type: String, required: true },
  my_cta_link: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("MailInfoSchema", MailInfoSchema);
